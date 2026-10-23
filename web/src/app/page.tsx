"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AlertsBell from "@/components/AlertsBell";
import AllocationPie from "@/components/AllocationPie";
import BookToggle, { PaperNotice } from "@/components/BookToggle";
import NewsFeed from "@/components/NewsFeed";
import SymbolSearch from "@/components/SymbolSearch";
import ValueChart from "@/components/ValueChart";
import { Evaluation, Portfolio, RiskProfile } from "@/lib/api";
import { getPortfolio, LOCAL_BOOK } from "@/lib/data/portfolio";
import { money, pct, tone } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { useApi } from "@/lib/useApi";
import { useLoader } from "@/lib/useLoader";
import { useBookMode } from "@/lib/useBookMode";
import { useIntroSeen } from "@/lib/useIntroSeen";

export default function Dashboard() {
  const [chosenMode, setMode] = useBookMode();
  const { on: local, ready } = useLocalMode();
  const mode = local ? LOCAL_BOOK : chosenMode;
  const { data: p, error } = useLoader<Portfolio>(ready ? () => getPortfolio(mode, local) : null, `portfolio:${mode}:${local}`);
  const { data: evals } = useApi<Evaluation[]>("/targets/evaluate");
  const { data: profile } = useApi<RiskProfile>("/safety/profile");
  const totals = p?.totals;
  const { t } = useI18n();
  const router = useRouter();
  const { seen } = useIntroSeen();
  // a first visit opens the welcome tour; leaving it marks it seen, so this runs once
  useEffect(() => {
    if (seen === false) router.replace("/welcome");
  }, [seen, router]);

  return (
    <>
      <div className="topbar">
        <h1>{t("dashboard.title")}</h1>
        <div className="row" style={{ flex: "0 1 auto" }}>
          {!local && <BookToggle mode={mode} onChange={setMode} />}
          <SymbolSearch />
          <AlertsBell />
        </div>
      </div>

      {profile && !profile.saved && (
        <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderColor: "color-mix(in srgb, var(--accent) 45%, var(--line))" }}>
          <div>
            <b>{t("dashboard.profileFirst")}</b>{" "}
            <span className="sub">{t("dashboard.profileWhy")}</span>
          </div>
          <Link href="/risk-profile" className="btn primary">{t("dashboard.start")}</Link>
        </div>
      )}
      {mode === "paper" && <PaperNotice />}
      {!!totals?.unpriced.length && (
        <div className="err" style={{ marginBottom: 16 }}>{t("dashboard.unpriced", { symbols: totals.unpriced.join(", ") })}</div>
      )}
      {error && <div className="err" style={{ marginBottom: 16 }}>{t("common.apiUnreachable", { error })}</div>}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label={t("dashboard.netWorth")} value={money(totals?.net_worth)} />
        <Stat label={t("dashboard.totalPnl")} value={money(totals?.pnl)} delta={pct(totals?.pnl_pct)} d={totals?.pnl} />
        <Stat label={t("dashboard.today")} value={money(totals?.day_change)} d={totals?.day_change} />
        <Stat label={t("common.cash")} value={money(totals?.cash)} />
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="span2">{!local && <ValueChart mode={mode} />}</div>
        <div className="card">
          <h2>{t("dashboard.allocation")}</h2>
          {p && <AllocationPie holdings={p.holdings} cash={p.totals.cash} />}
        </div>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <h2>{t("dashboard.holdings")}</h2>
          {p && !p.holdings.length ? (
            <div className="empty">{t("dashboard.noHoldings")} <Link href="/portfolio" style={{ color: "var(--accent)" }}>{t("dashboard.addOne")}</Link></div>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr><th>{t("common.symbol")}</th><th className="n">{t("common.price")}</th><th className="n">{t("common.day")}</th><th className="n">{t("common.value")}</th><th className="n">{t("common.pnl")}</th><th className="n">{t("dashboard.weight")}</th></tr>
                </thead>
                <tbody>
                  {p?.holdings.map((h) => (
                    <tr key={h.id}>
                      <td><Link href={`/stock?s=${h.symbol}`} className="sym">{h.symbol}</Link></td>
                      <td className="n">{money(h.price)}</td>
                      <td className={`n ${tone(h.day_change_pct)}`}>{pct(h.day_change_pct)}</td>
                      <td className="n">{money(h.value)}</td>
                      <td className={`n ${tone(h.pnl)}`}>{money(h.pnl)} <span className="sub">{pct(h.pnl_pct)}</span></td>
                      <td className="n">{h.weight_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2>{t("dashboard.targets")}</h2>
          {mode === "paper" && <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>{t("dashboard.targetsRealOnly")}</div>}
          {!evals?.length && <div className="empty"><Link href="/targets" style={{ color: "var(--accent)" }}>{t("dashboard.setTarget")}</Link></div>}
          {evals?.map((e) => (
            <Link key={e.target_id} href="/targets" style={{ display: "block", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{e.name} <span className="sub">{e.symbol ?? t("common.portfolio")}</span></span>
                <span className={`chip ${e.breaches.length ? "above_max" : "ok"}`}>{e.breaches.length ? t("dashboard.breaches", { n: e.breaches.length }) : t("dashboard.inRange")}</span>
              </div>
              {e.checks.profit.progress_pct != null && (
                <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${Math.max(0, Math.min(100, e.checks.profit.progress_pct))}%` }} /></div>
              )}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16 }}><NewsFeed /></div>
    </>
  );
}

function Stat({ label, value, delta, d }: { label: string; value: string; delta?: string; d?: number }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${d !== undefined ? tone(d) : ""}`}>{value}</div>
      {delta && <div className={`delta ${tone(d)}`}>{delta}</div>}
    </div>
  );
}
