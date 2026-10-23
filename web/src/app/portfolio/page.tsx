"use client";

import Link from "next/link";
import { useState } from "react";
import BookToggle from "@/components/BookToggle";
import SymbolSearch from "@/components/SymbolSearch";
import { CheckView } from "@/components/SafetyBits";
import { Account, CheckResult, Portfolio } from "@/lib/api";
import { addAccount, addHolding, getPortfolio, listAccounts, LOCAL_BOOK, removeAccount, removeHolding } from "@/lib/data/portfolio";
import { date, money, pct, tone } from "@/lib/format";
import { useI18n, type I18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { useLoader } from "@/lib/useLoader";
import { useBookMode } from "@/lib/useBookMode";

const accountLabel = (a: Account, t: I18n["t"]) => (a.broker === "paper" ? t("dashboard.portfolio.paperAccount", { name: a.name }) : a.name);

export default function PortfolioPage() {
  const { t, lang } = useI18n();
  const [chosenMode, setMode] = useBookMode();
  const { on: local, ready } = useLocalMode();
  const mode = local ? LOCAL_BOOK : chosenMode;
  const { data: p, reload, error } = useLoader<Portfolio>(ready ? () => getPortfolio(mode, local) : null, `portfolio:${mode}:${local}`);
  const { data: accounts, reload: reloadAccounts } = useLoader<Account[]>(ready ? () => listAccounts(local) : null, `accounts:${local}`);
  const [err, setErr] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);
  const [acc, setAcc] = useState({ name: "", broker: "manual", currency: "USD", cash: "" });
  const [h, setH] = useState({ account_id: "", symbol: "", quantity: "", avg_cost: "", opened_at: "" });

  const run = async (fn: () => Promise<unknown>) => {
    try { setErr(null); await fn(); await Promise.all([reload(), reloadAccounts()]); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="topbar"><h1>{t("dashboard.portfolio.title")}</h1></div>
      {(err || error) && <div className="err" style={{ marginBottom: 16 }}>{err || error}</div>}

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>{t("dashboard.portfolio.accounts")}</h2>
          <div className="scroll-x">
            <table>
              <thead><tr><th>{t("dashboard.portfolio.name")}</th><th>{t("dashboard.portfolio.broker")}</th><th className="n">{t("common.cash")}</th><th /></tr></thead>
              <tbody>
                {accounts?.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td><td className="sub">{a.broker}</td><td className="n">{money(a.cash, a.currency)}</td>
                    <td style={{ textAlign: "end" }}>
                      <button className="btn sm" onClick={() => confirm(t("dashboard.portfolio.confirmDelete", { name: a.name })) && run(() => removeAccount(a.id))}>{t("common.delete")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); run(async () => { await addAccount({ ...acc, cash: +acc.cash || 0 }); setAcc({ ...acc, name: "", cash: "" }); }); }}>
            <label className="f">{t("dashboard.portfolio.name")}<input required value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} placeholder={t("dashboard.portfolio.namePlaceholder")} /></label>
            <label className="f">{t("dashboard.portfolio.type")}
              <select value={acc.broker === "paper" ? "paper" : "manual"} onChange={(e) => setAcc({ ...acc, broker: e.target.value })}>
                <option value="manual">{t("dashboard.portfolio.typeReal")}</option>
                {!local && <option value="paper">{t("dashboard.portfolio.typePaper")}</option>}
              </select>
            </label>
            <label className="f">{t("common.cash")}<input type="number" step="any" value={acc.cash} onChange={(e) => setAcc({ ...acc, cash: e.target.value })} /></label>
            <button className="btn primary">{t("dashboard.portfolio.addAccount")}</button>
          </form>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t("dashboard.portfolio.manualNote")}</div>
        </div>

        <div className="card">
          <h2>{t("dashboard.portfolio.addHolding")}</h2>
          <form className="grid" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const out = await addHolding({
              account_id: local ? h.account_id : +h.account_id, symbol: h.symbol, quantity: +h.quantity, avg_cost: +h.avg_cost,
              ...(h.opened_at ? { opened_at: new Date(h.opened_at).toISOString() } : {}),
            });
            setLastCheck(out.check);
            setH({ ...h, symbol: "", quantity: "", avg_cost: "" });
          }); }}>
            <div className="row">
              <label className="f">{t("dashboard.portfolio.account")}
                <select required value={h.account_id} onChange={(e) => setH({ ...h, account_id: e.target.value })}>
                  <option value="">—</option>
                  {accounts?.map((a) => <option key={a.id} value={a.id}>{accountLabel(a, t)}</option>)}
                </select>
              </label>
              <label className="f">{t("common.symbol")} {h.symbol && <b className="sym" style={{ color: "var(--accent)" }}>{h.symbol}</b>}
                <SymbolSearch placeholder="AAPL" onPick={(s) => setH({ ...h, symbol: s })} />
              </label>
            </div>
            <div className="row">
              <label className="f">{t("dashboard.portfolio.quantity")}<input required type="number" step="any" min="0" value={h.quantity} onChange={(e) => setH({ ...h, quantity: e.target.value })} /></label>
              <label className="f">{t("dashboard.portfolio.avgCost")}<input required type="number" step="any" min="0" value={h.avg_cost} onChange={(e) => setH({ ...h, avg_cost: e.target.value })} /></label>
              <label className="f">{t("dashboard.portfolio.opened")}<input type="date" value={h.opened_at} onChange={(e) => setH({ ...h, opened_at: e.target.value })} /></label>
            </div>
            <button className="btn primary" disabled={!h.symbol || !h.account_id}>{t("dashboard.portfolio.addHolding")}</button>
          </form>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>
            {t("dashboard.portfolio.helpRecord")} {t("dashboard.portfolio.helpPaper")}
          </div>
          {lastCheck && lastCheck.verdict !== "pass" && (
            <div className="card" style={{ marginTop: 10, background: "var(--bg)" }}>
              <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>{t("dashboard.portfolio.addedNote")}</div>
              <CheckView check={lastCheck} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t("dashboard.portfolio.positions")}</h2>
          {!local && <BookToggle mode={mode} onChange={setMode} />}
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>{t("common.symbol")}</th><th>{t("dashboard.portfolio.account")}</th><th className="n">{t("dashboard.portfolio.qty")}</th><th className="n">{t("dashboard.portfolio.avgCost")}</th><th className="n">{t("common.price")}</th><th className="n">{t("common.value")}</th><th className="n">{t("common.pnl")}</th><th>{t("dashboard.portfolio.opened")}</th><th /></tr>
            </thead>
            <tbody>
              {p?.holdings.map((r) => (
                <tr key={r.id}>
                  <td><Link className="sym" href={`/stock?s=${r.symbol}`}>{r.symbol}</Link></td>
                  <td className="sub">{accounts?.find((a) => a.id === r.account_id)?.name}</td>
                  <td className="n">{r.quantity}</td>
                  <td className="n">{money(r.avg_cost)}</td>
                  <td className="n">{money(r.price)}</td>
                  <td className="n">{money(r.value)}</td>
                  <td className={`n ${tone(r.pnl)}`}>{money(r.pnl)} <span className="sub">{pct(r.pnl_pct)}</span></td>
                  <td className="sub">{date(r.opened_at, lang)}</td>
                  <td style={{ textAlign: "end" }}><button className="btn sm" onClick={() => run(() => removeHolding(r.id))}>{t("common.remove")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p && !p.holdings.length && <div className="empty">{t("dashboard.portfolio.noPositions")}</div>}
      </div>
    </>
  );
}
