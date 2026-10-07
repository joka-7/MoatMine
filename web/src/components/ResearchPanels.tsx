"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Analysts, api, Company, Dividends, Earning, NewsItem, NewsSummary } from "@/lib/api";
import { date, money, num, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const TT = { background: "#14171c", border: "1px solid #262a32", borderRadius: 8 };
const AX = { stroke: "#8b909a", fontSize: 11, tickLine: false, axisLine: false } as const;

export function CompanyCard({ symbol }: { symbol: string }) {
  const { data: c } = useApi<Company>(`/stocks/${symbol}/company`);
  const [more, setMore] = useState(false);
  if (!c) return <div className="card"><h2>About</h2><div className="empty">Loading…</div></div>;
  const desc = c.description || "";
  const facts: [string, React.ReactNode][] = [
    ["Sector", c.sector], ["Industry", c.industry], ["Exchange", c.exchange], ["Country", c.country],
    ["Employees", c.employees ? c.employees.toLocaleString() : null], ["CEO", c.ceo], ["IPO", c.ipo],
    ["Market cap", c.market_cap ? money(c.market_cap * 1e6).replace(/\.\d+$/, "") : null],
    ["Website", c.website ? <a href={c.website} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{c.website.replace(/^https?:\/\//, "")}</a> : null],
  ];
  return (
    <div className="card">
      <h2>About {c.name}</h2>
      {desc ? (
        <p style={{ marginTop: 0, color: "var(--text)" }}>
          {more || desc.length < 420 ? desc : desc.slice(0, 420) + "… "}
          {desc.length >= 420 && <a style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setMore(!more)}>{more ? " less" : "more"}</a>}
        </p>
      ) : (
        <p className="sub" style={{ marginTop: 0 }}>No description from the current provider. Add FMP_API_KEY on the backend for company descriptions.</p>
      )}
      <div className="grid g3" style={{ gap: "0 16px" }}>
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="sub">{k}</span><span style={{ textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EarningsPanel({ symbol }: { symbol: string }) {
  const { data } = useApi<Earning[]>(`/stocks/${symbol}/earnings`);
  const rows = [...(data ?? [])].reverse();
  return (
    <div className="card">
      <h2>Earnings per share · actual vs estimate</h2>
      {!rows.length ? <div className="empty">No earnings data.</div> : (
        <>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={rows}>
                <CartesianGrid stroke="#1d2128" vertical={false} />
                <XAxis dataKey="period" {...AX} />
                <YAxis {...AX} />
                <Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="estimate" name="Estimate" fill="#3a404a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#e8b04a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table>
            <thead><tr><th>Quarter</th><th className="n">Estimate</th><th className="n">Actual</th><th className="n">Surprise</th></tr></thead>
            <tbody>
              {data!.map((e) => (
                <tr key={e.period}>
                  <td>{e.period}</td><td className="n">{num(e.estimate)}</td><td className="n">{num(e.actual)}</td>
                  <td className={`n ${tone(e.surprise_pct)}`}>{pct(e.surprise_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function DividendsPanel({ symbol }: { symbol: string }) {
  const { data } = useApi<Dividends>(`/stocks/${symbol}/dividends`);
  const divs = [...(data?.dividends ?? [])].filter((d) => d.amount != null).reverse();
  return (
    <div className="card">
      <h2>Dividends & splits</h2>
      {!divs.length ? <div className="empty">No dividend history from the current provider.</div> : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={divs}>
              <XAxis dataKey="date" {...AX} tickFormatter={(d: string) => d.slice(0, 7)} />
              <YAxis {...AX} />
              <Tooltip contentStyle={TT} formatter={(x: number) => money(x)} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="amount" name="Dividend" fill="#49c58c" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!!data?.splits.length && (
        <div style={{ marginTop: 10 }}>
          <div className="sub" style={{ fontSize: 12 }}>Splits</div>
          {data.splits.map((s) => (
            <div key={s.date} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>{date(s.date)}</span><span className="num">{s.ratio}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalystsPanel({ symbol }: { symbol: string }) {
  const { data } = useApi<Analysts>(`/stocks/${symbol}/analysts`);
  const recs = [...(data?.recommendations ?? [])].reverse();
  const t = data?.price_target;
  const latest = data?.recommendations[0];
  const total = latest ? latest.strong_buy + latest.buy + latest.hold + latest.sell + latest.strong_sell : 0;
  return (
    <div className="grid g2">
      <div className="card">
        <h2>Recommendation trend</h2>
        {!recs.length ? <div className="empty">No analyst data.</div> : (
          <>
            {latest && total > 0 && (
              <div className="sub" style={{ marginBottom: 8 }}>
                Latest: {Math.round(((latest.strong_buy + latest.buy) / total) * 100)}% buy · {Math.round((latest.hold / total) * 100)}% hold ·{" "}
                {Math.round(((latest.sell + latest.strong_sell) / total) * 100)}% sell ({total} analysts)
              </div>
            )}
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={recs}>
                  <XAxis dataKey="period" {...AX} tickFormatter={(d: string) => d.slice(0, 7)} />
                  <YAxis {...AX} />
                  <Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="strong_buy" name="Strong buy" stackId="a" fill="#2f9e6e" />
                  <Bar dataKey="buy" name="Buy" stackId="a" fill="#49c58c" />
                  <Bar dataKey="hold" name="Hold" stackId="a" fill="#d9a13b" />
                  <Bar dataKey="sell" name="Sell" stackId="a" fill="#ec6650" />
                  <Bar dataKey="strong_sell" name="Strong sell" stackId="a" fill="#a8382a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
      <div className="card">
        <h2>Price target</h2>
        {!t ? <div className="empty">No consensus target on the current data plan.</div> : (
          <>
            <div className="grid g3" style={{ marginBottom: 16 }}>
              <div className="stat"><div className="label">Low</div><div className="value" style={{ fontSize: 18 }}>{money(t.low)}</div></div>
              <div className="stat"><div className="label">Consensus</div><div className="value" style={{ fontSize: 18 }}>{money(t.mean)}</div>
                <div className={`delta ${tone(t.upside_pct)}`}>{pct(t.upside_pct)} vs price</div></div>
              <div className="stat"><div className="label">High</div><div className="value" style={{ fontSize: 18 }}>{money(t.high)}</div></div>
            </div>
            {t.low != null && t.high != null && data && <TargetRange low={t.low} high={t.high} mean={t.mean ?? 0} price={data.price} />}
            {t.updated && <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>Updated {t.updated}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function TargetRange({ low, high, mean, price }: { low: number; high: number; mean: number; price: number }) {
  const lo = Math.min(low, price) * 0.97, hi = Math.max(high, price) * 1.03;
  const at = (x: number) => `${((x - lo) / (hi - lo)) * 100}%`;
  return (
    <div style={{ position: "relative", height: 46 }}>
      <div style={{ position: "absolute", top: 20, left: at(low), width: `calc(${at(high)} - ${at(low)})`, height: 6, borderRadius: 3, background: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
      <div title="consensus" style={{ position: "absolute", top: 14, left: at(mean), width: 2, height: 18, marginLeft: -1, background: "var(--accent)" }} />
      <div title="price" style={{ position: "absolute", top: 16, left: at(price), width: 14, height: 14, marginLeft: -7, borderRadius: 99, background: "var(--text)" }} />
      <div className="sub" style={{ position: "absolute", top: 34, left: at(price), transform: "translateX(-50%)", fontSize: 11 }}>now {money(price)}</div>
    </div>
  );
}

const SENT_TONE: Record<string, string> = { bullish: "ok", bearish: "below_min", mixed: "", neutral: "", unknown: "" };

export function NewsPanel({ symbol }: { symbol: string }) {
  const [days, setDays] = useState(7);
  const { data } = useApi<NewsItem[]>(`/stocks/${symbol}/news?days=${days}`);
  const [sum, setSum] = useState<NewsSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const summarize = async () => {
    setBusy(true); setErr(null);
    try { setSum(await api<NewsSummary>(`/stocks/${symbol}/news/summary?days=${days}`)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid g3">
      <div className="card span2 news">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>News</h2>
          <select value={days} onChange={(e) => { setDays(+e.target.value); setSum(null); }} style={{ flex: 0, minWidth: 90 }}>
            {[1, 3, 7, 14, 30, 90].map((d) => <option key={d} value={d}>{d}d</option>)}
          </select>
        </div>
        <ul>
          {data?.map((n, i) => (
            <li key={i} style={{ display: "flex", gap: 12 }}>
              {n.image && <img src={n.image} alt="" style={{ width: 72, height: 48, objectFit: "cover", borderRadius: 6, flex: "none" }} />}
              <a href={n.url || undefined} target="_blank" rel="noreferrer">
                <div className="h">{n.headline}</div>
                {n.summary && <div className="sub" style={{ fontSize: 13 }}>{n.summary.slice(0, 220)}{n.summary.length > 220 ? "…" : ""}</div>}
                <div className="sub" style={{ fontSize: 12 }}>{n.source} · {date(n.datetime)}</div>
              </a>
            </li>
          ))}
        </ul>
        {data && !data.length && <div className="empty">No news in this window.</div>}
      </div>
      <div className="card">
        <h2>AI digest</h2>
        {!sum && <div className="sub" style={{ marginBottom: 10 }}>Summarise the last {days} days of headlines and label the sentiment.</div>}
        {sum && (
          <>
            <span className={`chip ${SENT_TONE[sum.sentiment]}`}>{sum.sentiment}</span>
            <p>{sum.summary}</p>
            {sum.points.length > 0 && <ul style={{ paddingLeft: 18, margin: "0 0 10px" }}>{sum.points.map((p, i) => <li key={i} style={{ listStyle: "disc", padding: "2px 0", border: 0 }}>{p}</li>)}</ul>}
            {sum.watch && <div><span className="sub">Watch:</span> {sum.watch}</div>}
            <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>{sum.count} headlines · {sum.model}{sum.cached ? " · cached" : ""} · not advice</div>
          </>
        )}
        {err && <div className="err" style={{ margin: "8px 0" }}>{err}</div>}
        <button className="btn primary" style={{ marginTop: 10 }} onClick={summarize} disabled={busy}>{busy ? "Summarising…" : sum ? "Refresh" : "Summarise"}</button>
      </div>
    </div>
  );
}
