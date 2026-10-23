"use client";

import Link from "next/link";
import { useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import { WatchRow } from "@/lib/api";
import { addWatch, listWatch, removeWatch } from "@/lib/data/watchlist";
import { money, pct, tone } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useLoader } from "@/lib/useLoader";
import { useLocalMode } from "@/lib/localMode";

export default function WatchlistPage() {
  const { t } = useI18n();
  const { on: local, ready } = useLocalMode();
  const { data, reload } = useLoader<WatchRow[]>(ready ? () => listWatch(local) : null, `watchlist:${local}`);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", note: "", alert_above: "", alert_below: "" });

  const run = async (fn: () => Promise<unknown>) => {
    try { setErr(null); await fn(); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const n = (s: string) => (s === "" ? null : +s);

  return (
    <>
      <div className="topbar"><h1>{t("dashboard.watch.title")}</h1></div>
      {err && <div className="err" style={{ marginBottom: 16 }}>{err}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>{t("dashboard.watch.add")}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => {
          await addWatch({ symbol: form.symbol, note: form.note, alert_above: n(form.alert_above), alert_below: n(form.alert_below) });
          setForm({ symbol: "", note: "", alert_above: "", alert_below: "" });
        }); }}>
          <label className="f">{t("common.symbol")} {form.symbol && <b className="sym" style={{ color: "var(--accent)" }}>{form.symbol}</b>}
            <SymbolSearch placeholder="TSLA" onPick={(s) => setForm({ ...form, symbol: s })} />
          </label>
          <label className="f">{t("dashboard.watch.why")}<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("dashboard.watch.whyPlaceholder")} /></label>
          <label className="f">{t("dashboard.watch.alertAbove")}<input type="number" step="any" value={form.alert_above} onChange={(e) => setForm({ ...form, alert_above: e.target.value })} /></label>
          <label className="f">{t("dashboard.watch.alertBelow")}<input type="number" step="any" value={form.alert_below} onChange={(e) => setForm({ ...form, alert_below: e.target.value })} /></label>
          <button className="btn primary" disabled={!form.symbol}>{t("common.add")}</button>
        </form>
      </div>

      <div className="card">
        <div className="scroll-x">
          <table>
            <thead><tr><th>{t("common.symbol")}</th><th className="n">{t("common.price")}</th><th className="n">{t("common.day")}</th><th className="n">{t("dashboard.watch.above")}</th><th className="n">{t("dashboard.watch.below")}</th><th>{t("dashboard.watch.note")}</th><th /></tr></thead>
            <tbody>
              {data?.map((w) => {
                const hit = w.quote && ((w.alert_above != null && w.quote.price >= w.alert_above) || (w.alert_below != null && w.quote.price <= w.alert_below));
                return (
                  <tr key={w.id}>
                    <td><Link className="sym" href={`/stock?s=${w.symbol}`}>{w.symbol}</Link> {hit && <span className="chip above_max">{t("dashboard.watch.triggered")}</span>}</td>
                    <td className="n">{money(w.quote?.price)}</td>
                    <td className={`n ${tone(w.quote?.change_pct)}`}>{pct(w.quote?.change_pct)}</td>
                    <td className="n">{w.alert_above ?? "—"}</td>
                    <td className="n">{w.alert_below ?? "—"}</td>
                    <td className="sub">{w.note}</td>
                    <td style={{ textAlign: "end" }}><button className="btn sm" onClick={() => run(() => removeWatch(w.id))}>{t("common.remove")}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && !data.length && <div className="empty">{t("dashboard.watch.empty")}</div>}
      </div>
    </>
  );
}
