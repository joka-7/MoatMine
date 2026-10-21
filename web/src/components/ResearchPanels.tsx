"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Analysts, api, Company, Dividends, Earning, NewsItem, NewsSummary } from "@/lib/api";
import { date, money, num, pct, tone } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

const TT = { background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8 };
const AX = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;

export function CompanyCard({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const { data: c } = useApi<Company>(`/stocks/${symbol}/company`);
  const [more, setMore] = useState(false);
  if (!c) return <div className="card"><h2>{t("stock.company.about")}</h2><div className="empty">{t("common.loading")}</div></div>;
  const desc = c.description || "";
  const facts: [MessageKey, React.ReactNode][] = [
    ["stock.company.sector", c.sector], ["stock.company.industry", c.industry], ["stock.company.exchange", c.exchange], ["stock.company.country", c.country],
    ["stock.company.employees", c.employees ? c.employees.toLocaleString() : null], ["stock.company.ceo", c.ceo], ["stock.company.ipo", c.ipo],
    ["stock.company.marketCap", c.market_cap ? money(c.market_cap * 1e6, "USD", 0) : null],
    ["stock.company.website", c.website ? <a href={c.website} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{c.website.replace(/^https?:\/\//, "")}</a> : null],
  ];
  return (
    <div className="card">
      <h2>{t("stock.company.aboutName", { name: c.name })}</h2>
      {desc ? (
        <p style={{ marginTop: 0, color: "var(--text)" }}>
          {more || desc.length < 420 ? desc : desc.slice(0, 420) + "… "}
          {desc.length >= 420 && <a style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setMore(!more)}>{more ? t("stock.company.less") : t("stock.company.more")}</a>}
        </p>
      ) : (
        <p className="sub" style={{ marginTop: 0 }}>{t("stock.company.noDescription")}</p>
      )}
      <div className="grid g3" style={{ gap: "0 16px" }}>
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="sub">{t(k)}</span><span style={{ textAlign: "end" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EarningsPanel({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const { data } = useApi<Earning[]>(`/stocks/${symbol}/earnings`);
  const rows = [...(data ?? [])].reverse();
  return (
    <div className="card">
      <h2>{t("stock.earnings.title")}</h2>
      {!rows.length ? <div className="empty">{t("stock.earnings.none")}</div> : (
        <>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={rows}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="period" {...AX} />
                <YAxis {...AX} />
                <Tooltip contentStyle={TT} cursor={{ fill: "var(--chart-cursor)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="estimate" name={t("stock.earnings.estimate")} fill="var(--chart-neutral)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name={t("stock.earnings.actual")} fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{t("stock.earnings.quarter")}</th><th className="n">{t("stock.earnings.estimate")}</th>
                  <th className="n">{t("stock.earnings.actual")}</th><th className="n">{t("stock.earnings.surprise")}</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((e) => (
                  <tr key={e.period}>
                    <td>{e.period}</td><td className="n">{num(e.estimate)}</td><td className="n">{num(e.actual)}</td>
                    <td className={`n ${tone(e.surprise_pct)}`}>{pct(e.surprise_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function DividendsPanel({ symbol }: { symbol: string }) {
  const { t, lang } = useI18n();
  const { data } = useApi<Dividends>(`/stocks/${symbol}/dividends`);
  const divs = [...(data?.dividends ?? [])].filter((d) => d.amount != null).reverse();
  return (
    <div className="card">
      <h2>{t("stock.dividends.title")}</h2>
      {!divs.length ? <div className="empty">{t("stock.dividends.none")}</div> : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={divs}>
              <XAxis dataKey="date" {...AX} tickFormatter={(d: string) => d.slice(0, 7)} />
              <YAxis {...AX} />
              <Tooltip contentStyle={TT} formatter={(x: number) => money(x)} cursor={{ fill: "var(--chart-cursor)" }} />
              <Bar dataKey="amount" name={t("stock.dividends.dividend")} fill="var(--up)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!!data?.splits.length && (
        <div style={{ marginTop: 10 }}>
          <div className="sub" style={{ fontSize: 12 }}>{t("stock.dividends.splits")}</div>
          {data.splits.map((s) => (
            <div key={s.date} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>{date(s.date, lang)}</span><span className="num">{s.ratio}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalystsPanel({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const { data } = useApi<Analysts>(`/stocks/${symbol}/analysts`);
  const recs = [...(data?.recommendations ?? [])].reverse();
  const pt = data?.price_target;
  const latest = data?.recommendations[0];
  const total = latest ? latest.strong_buy + latest.buy + latest.hold + latest.sell + latest.strong_sell : 0;
  return (
    <div className="grid g2">
      <div className="card">
        <h2>{t("stock.analysts.trend")}</h2>
        {!recs.length ? <div className="empty">{t("stock.analysts.none")}</div> : (
          <>
            {latest && total > 0 && (
              <div className="sub" style={{ marginBottom: 8 }}>
                {t("stock.analysts.latest", {
                  buy: Math.round(((latest.strong_buy + latest.buy) / total) * 100),
                  hold: Math.round((latest.hold / total) * 100),
                  sell: Math.round(((latest.sell + latest.strong_sell) / total) * 100),
                  total,
                })}
              </div>
            )}
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={recs}>
                  <XAxis dataKey="period" {...AX} tickFormatter={(d: string) => d.slice(0, 7)} />
                  <YAxis {...AX} />
                  <Tooltip contentStyle={TT} cursor={{ fill: "var(--chart-cursor)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="strong_buy" name={t("stock.analysts.strongBuy")} stackId="a" fill="#2f9e6e" />
                  <Bar dataKey="buy" name={t("stock.analysts.buy")} stackId="a" fill="var(--up)" />
                  <Bar dataKey="hold" name={t("stock.analysts.hold")} stackId="a" fill="var(--warn)" />
                  <Bar dataKey="sell" name={t("stock.analysts.sell")} stackId="a" fill="var(--down)" />
                  <Bar dataKey="strong_sell" name={t("stock.analysts.strongSell")} stackId="a" fill="#a8382a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
      <div className="card">
        <h2>{t("stock.analysts.target")}</h2>
        {!pt ? <div className="empty">{t("stock.analysts.noTarget")}</div> : (
          <>
            <div className="grid g3" style={{ marginBottom: 16 }}>
              <div className="stat"><div className="label">{t("stock.analysts.low")}</div><div className="value" style={{ fontSize: 18 }}>{money(pt.low)}</div></div>
              <div className="stat"><div className="label">{t("stock.analysts.consensus")}</div><div className="value" style={{ fontSize: 18 }}>{money(pt.mean)}</div>
                <div className={`delta ${tone(pt.upside_pct)}`}>{t("stock.analysts.vsPrice", { pct: pct(pt.upside_pct) })}</div></div>
              <div className="stat"><div className="label">{t("stock.analysts.high")}</div><div className="value" style={{ fontSize: 18 }}>{money(pt.high)}</div></div>
            </div>
            {pt.low != null && pt.high != null && data && <TargetRange low={pt.low} high={pt.high} mean={pt.mean ?? 0} price={data.price} />}
            {pt.updated && <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>{t("stock.analysts.updated", { date: pt.updated })}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function TargetRange({ low, high, mean, price }: { low: number; high: number; mean: number; price: number }) {
  const { t } = useI18n();
  const lo = Math.min(low, price) * 0.97, hi = Math.max(high, price) * 1.03;
  const at = (x: number) => `${((x - lo) / (hi - lo)) * 100}%`;
  return (
    <div style={{ position: "relative", height: 46 }}>
      <div style={{ position: "absolute", top: 20, left: at(low), width: `calc(${at(high)} - ${at(low)})`, height: 6, borderRadius: 3, background: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
      <div title={t("stock.analysts.consensusMark")} style={{ position: "absolute", top: 14, left: at(mean), width: 2, height: 18, marginLeft: -1, background: "var(--accent)" }} />
      <div title={t("stock.analysts.priceMark")} style={{ position: "absolute", top: 16, left: at(price), width: 14, height: 14, marginLeft: -7, borderRadius: 99, background: "var(--text)" }} />
      <div className="sub" style={{ position: "absolute", top: 34, left: at(price), transform: "translateX(-50%)", fontSize: 11 }}>{t("stock.analysts.now", { price: money(price) })}</div>
    </div>
  );
}

const SENT_TONE: Record<string, string> = { bullish: "ok", bearish: "below_min", mixed: "", neutral: "", unknown: "" };
const SENTIMENT: Record<string, MessageKey> = {
  bullish: "stock.news.sentiment.bullish", bearish: "stock.news.sentiment.bearish", mixed: "stock.news.sentiment.mixed",
  neutral: "stock.news.sentiment.neutral", unknown: "stock.news.sentiment.unknown",
};

export function NewsPanel({ symbol }: { symbol: string }) {
  const { t, lang } = useI18n();
  const [days, setDays] = useState(7);
  const { data } = useApi<NewsItem[]>(`/stocks/${symbol}/news?days=${days}`);
  const [sum, setSum] = useState<NewsSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sentimentLabel = (sentiment: string) => {
    const key = SENTIMENT[sentiment];
    return key ? t(key) : sentiment;
  };

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
          <h2 style={{ margin: 0 }}>{t("stock.news.title")}</h2>
          <select value={days} onChange={(e) => { setDays(+e.target.value); setSum(null); }} style={{ flex: "0 1 auto", minWidth: 90 }}>
            {[1, 3, 7, 14, 30, 90].map((d) => <option key={d} value={d}>{t("stock.news.days", { n: d })}</option>)}
          </select>
        </div>
        <ul>
          {data?.map((n, i) => (
            <li key={i} style={{ display: "flex", gap: 12 }}>
              {/* remote news thumbnails: next/image can't optimise them in the static desktop export */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {n.image && <img src={n.image} alt="" style={{ width: 72, height: 48, objectFit: "cover", borderRadius: 6, flex: "none" }} />}
              <a href={n.url || undefined} target="_blank" rel="noreferrer">
                <div className="h">{n.headline}</div>
                {n.summary && <div className="sub" style={{ fontSize: 13 }}>{n.summary.slice(0, 220)}{n.summary.length > 220 ? "…" : ""}</div>}
                <div className="sub" style={{ fontSize: 12 }}>{n.source} · {date(n.datetime, lang)}</div>
              </a>
            </li>
          ))}
        </ul>
        {data && !data.length && <div className="empty">{t("stock.news.none")}</div>}
      </div>
      <div className="card">
        <h2>{t("stock.news.digest")}</h2>
        {!sum && <div className="sub" style={{ marginBottom: 10 }}>{t("stock.news.digestHint", { days })}</div>}
        {sum && (
          <>
            <span className={`chip ${SENT_TONE[sum.sentiment]}`}>{sentimentLabel(sum.sentiment)}</span>
            <p>{sum.summary}</p>
            {sum.points.length > 0 && <ul style={{ paddingInlineStart: 18, margin: "0 0 10px" }}>{sum.points.map((p, i) => <li key={i} style={{ listStyle: "disc", padding: "2px 0", border: 0 }}>{p}</li>)}</ul>}
            {sum.watch && <div><span className="sub">{t("stock.news.watch")}</span> {sum.watch}</div>}
            <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>{t(sum.cached ? "stock.news.metaCached" : "stock.news.meta", { count: sum.count, model: sum.model ?? "" })}</div>
          </>
        )}
        {err && <div className="err" style={{ margin: "8px 0" }}>{err}</div>}
        <button className="btn primary" style={{ marginTop: 10 }} onClick={summarize} disabled={busy}>{t(busy ? "stock.news.summarising" : sum ? "stock.news.refresh" : "stock.news.summarise")}</button>
      </div>
    </div>
  );
}
