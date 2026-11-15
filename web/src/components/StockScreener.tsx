"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { addWatch } from "@/lib/data/watchlist";
import { isSampleData } from "@/lib/dataSource";
import { money, pct, share, tone } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { candidates, matches, NO_FILTERS, PRESETS, sortRows, type Filters, type MetricRow, type PerfWindow, type SortKey } from "@/lib/screener/filter";
import { describeCompany, loadCustom, saveCustom, withEntry } from "@/lib/screener/custom";
import { loadMetrics } from "@/lib/screener/load";
import { UNIVERSE, type UniverseEntry } from "@/lib/screener/universe";
import SymbolSearch from "./SymbolSearch";

/** Above this many companies a run is slow on a free data plan, so the screen says so before it starts. */
const BIG_RUN = 30;

const WINDOWS: readonly (readonly [PerfWindow, MessageKey])[] = [
  ["perf_1m", "screener.window.1m"], ["perf_3m", "screener.window.3m"], ["perf_6m", "screener.window.6m"], ["perf_12m", "screener.window.12m"],
];
const PRESET_LABELS: readonly (readonly [keyof typeof PRESETS, MessageKey])[] = [
  ["nearLow", "screener.preset.nearLow"], ["momentum", "screener.preset.momentum"], ["lowRisk", "screener.preset.lowRisk"], ["cheap", "screener.preset.cheap"],
];

/** The numeric filters as the user is typing them: text until it is read as a number. */
type Draft = Record<"maxPe" | "maxVolatility" | "maxDrawdown" | "minPerf" | "maxPerf" | "minMomentum" | "nearHigh" | "nearLow", string>;
const NUMBER_KEYS = ["maxPe", "maxVolatility", "maxDrawdown", "minPerf", "maxPerf", "minMomentum", "nearHigh", "nearLow"] as const;
const BLANK: Draft = { maxPe: "", maxVolatility: "", maxDrawdown: "", minPerf: "", maxPerf: "", minMomentum: "", nearHigh: "", nearLow: "" };

const toDraft = (f: Filters): Draft => Object.fromEntries(NUMBER_KEYS.map((k) => [k, f[k] === null ? "" : String(f[k])])) as Draft;
const numberOrNull = (text: string): number | null => (text.trim() === "" || Number.isNaN(Number(text)) ? null : Number(text));

function Choice({ label, options, chosen, show, onChange }: { label: string; options: readonly string[]; chosen: readonly string[]; show: (v: string) => string; onChange: (next: string[]) => void }) {
  return (
    <details className="f">
      <summary>{label}{chosen.length > 0 && ` (${chosen.length})`}</summary>
      <div style={{ maxHeight: 180, overflowY: "auto", padding: "6px 0" }}>
        {options.map((o) => (
          <label key={o} style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0" }}>
            <input type="checkbox" checked={chosen.includes(o)} onChange={(e) => onChange(e.target.checked ? [...chosen, o] : chosen.filter((c) => c !== o))} />
            {show(o)}
          </label>
        ))}
      </div>
    </details>
  );
}

/**
 * Finds stocks to put on the watchlist: choose where a company is (sector, industry, country), load
 * its numbers, then narrow by value, risk, performance, momentum and distance from the yearly high
 * or low. The list searched is a curated one, not the whole market.
 */
export default function StockScreener({ watched, onAdded }: { watched: ReadonlySet<string>; onAdded: () => void }) {
  const { t, ts } = useI18n();
  const [where, setWhere] = useState<Pick<Filters, "sectors" | "industries" | "countries">>({ sectors: [], industries: [], countries: [] });
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [perfWindow, setPerfWindow] = useState<PerfWindow>("perf_3m");
  const [aboveSma200, setAboveSma200] = useState(false);
  const [custom, setCustom] = useState<UniverseEntry[]>(() => (typeof window === "undefined" ? [] : loadCustom()));
  const [rows, setRows] = useState<readonly MetricRow[] | null>(null);
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [stopped, setStopped] = useState<{ cancelled: boolean; notLoaded: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const run = useRef<AbortController | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "perf_3m", direction: "desc" });
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState("");

  const filters = useMemo<Filters>(() => ({
    ...NO_FILTERS, ...where, perfWindow, aboveSma200,
    ...Object.fromEntries(NUMBER_KEYS.map((k) => [k, numberOrNull(draft[k])])) as Pick<Filters, (typeof NUMBER_KEYS)[number]>,
  }), [where, draft, perfWindow, aboveSma200]);

  const universe = useMemo(() => [...UNIVERSE, ...custom], [custom]);
  const byId = useMemo(() => new Map(universe.map((u) => [u.symbol, u])), [universe]);
  const sectors = useMemo(() => [...new Set(universe.map((u) => u.sector))].sort(), [universe]);
  const countries = useMemo(() => [...new Set(universe.map((u) => u.country))].sort(), [universe]);
  const industries = useMemo(
    () => [...new Set(universe.filter((u) => where.sectors.length === 0 || where.sectors.includes(u.sector)).map((u) => u.industry))].sort(),
    [universe, where.sectors],
  );
  const toLoad = useMemo(() => candidates(filters, universe), [filters, universe]);
  const shown = useMemo(() => (rows ? sortRows(rows.filter((r) => matches(r, filters)), sort.key, sort.direction) : []), [rows, filters, sort]);
  const failedRows = rows?.filter((r) => r.error) ?? [];
  const failed = failedRows.length;
  const busy = failedRows.filter((r) => r.error === "rate_limited").length;
  const addable = shown.filter((r) => !watched.has(r.symbol));

  const applyPreset = (p: keyof typeof PRESETS) => {
    setDraft(toDraft(PRESETS[p]));
    setAboveSma200(PRESETS[p].aboveSma200);
    setPerfWindow(PRESETS[p].perfWindow);
  };

  /** Load `symbols`, replacing what is shown (`merge` false) or filling in over it (`merge` true: a retry). */
  const load = async (symbols: readonly string[], merge: boolean) => {
    setStatus("");
    setStopped(null);
    setProgress(0);
    const controller = new AbortController();
    run.current = controller;
    const before = merge ? (rows ?? []).filter((r) => !symbols.includes(r.symbol)) : [];
    try {
      const out = await loadMetrics(symbols, {
        signal: controller.signal,
        onProgress: (loaded, label, done) => {
          setRows([...before, ...loaded]);
          setSource(label);
          setProgress(done);
        },
      });
      setRows([...before, ...out.rows]);
      if (out.source) setSource(out.source);
      setStopped(out.cancelled || out.notLoaded.length > 0 ? { cancelled: out.cancelled, notLoaded: out.notLoaded.length } : null);
      if (!merge) setPicked(new Set());
    } catch (e) {
      setStatus(t("screener.loadFailed", { error: (e as Error).message }));
    } finally {
      run.current = null;
      setProgress(null);
    }
  };

  const addCompany = async (symbol: string) => {
    setAdding(true);
    setStatus("");
    try {
      const next = withEntry(custom, await describeCompany(symbol));
      saveCustom(next);
      setCustom(next);
      setStatus(t("screener.companyAdded", { symbol: symbol.toUpperCase() }));
    } catch (e) {
      setStatus(t("screener.companyFailed", { error: (e as Error).message }));
    } finally {
      setAdding(false);
    }
  };

  const removeCompany = (symbol: string) => {
    const next = custom.filter((u) => u.symbol !== symbol);
    saveCustom(next);
    setCustom(next);
  };

  const add = async (symbols: readonly string[]) => {
    const failures: string[] = [];
    for (const symbol of symbols) {
      try {
        await addWatch({ symbol, note: "", alert_above: null, alert_below: null });
      } catch (e) {
        failures.push(`${symbol}: ${(e as Error).message}`);
      }
    }
    onAdded();
    setPicked(new Set());
    setStatus(failures.length ? t("screener.addedSome", { added: symbols.length - failures.length, failed: failures.join("; ") }) : t("screener.added", { n: symbols.length }));
  };

  const header = (key: SortKey, label: MessageKey) => (
    <th className={key === "symbol" ? "" : "n"}>
      <button className="btn sm ghost" onClick={() => setSort((s) => ({ key, direction: s.key === key && s.direction === "desc" ? "asc" : "desc" }))}>
        {t(label)}{sort.key === key ? (sort.direction === "desc" ? " ▼" : " ▲") : ""}
      </button>
    </th>
  );
  const field = (key: keyof Draft, label: MessageKey, step = "any") => (
    <label className="f">{t(label)}
      <input type="number" step={step} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>{t("screener.title")}</h2>
      <p className="sub">{t("screener.intro", { n: universe.length })}</p>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <Choice label={t("screener.sector")} options={sectors} chosen={where.sectors} show={ts}
          onChange={(sectors) => setWhere({ ...where, sectors, industries: [] })} />
        <Choice label={t("screener.industry")} options={industries} chosen={where.industries} show={ts} onChange={(next) => setWhere({ ...where, industries: next })} />
        <Choice label={t("screener.country")} options={countries} chosen={where.countries} show={ts} onChange={(next) => setWhere({ ...where, countries: next })} />
      </div>

      <div className="row" style={{ margin: "8px 0" }}>
        {PRESET_LABELS.map(([key, label]) => <button key={key} className="btn sm" onClick={() => applyPreset(key)}>{t(label)}</button>)}
        <button className="btn sm ghost" onClick={() => { setDraft(BLANK); setAboveSma200(false); }}>{t("screener.clear")}</button>
      </div>

      <div className="row" style={{ flexWrap: "wrap" }}>
        {field("maxPe", "screener.maxPe")}
        {field("maxVolatility", "screener.maxVolatility")}
        {field("maxDrawdown", "screener.maxDrawdown")}
        <label className="f">{t("screener.perfWindow")}
          <select value={perfWindow} onChange={(e) => setPerfWindow(e.target.value as PerfWindow)}>
            {WINDOWS.map(([w, label]) => <option key={w} value={w}>{t(label)}</option>)}
          </select>
        </label>
        {field("minPerf", "screener.minPerf")}
        {field("maxPerf", "screener.maxPerf")}
        {field("minMomentum", "screener.minMomentum")}
        {field("nearHigh", "screener.nearHigh")}
        {field("nearLow", "screener.nearLow")}
        <label className="f" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={aboveSma200} onChange={(e) => setAboveSma200(e.target.checked)} />{t("screener.aboveSma200")}
        </label>
      </div>

      <div className="row" style={{ alignItems: "center", margin: "10px 0" }}>
        {progress === null ? (
          <button className="btn primary" disabled={toLoad.length === 0} onClick={() => void load(toLoad.map((u) => u.symbol), false)}>
            {t("screener.load", { n: toLoad.length })}
          </button>
        ) : (
          <>
            <button className="btn primary" disabled>{t("screener.loading", { done: progress, total: toLoad.length })}</button>
            <button className="btn" onClick={() => run.current?.abort()}>{t("screener.stop")}</button>
          </>
        )}
        {toLoad.length === 0 && <span className="sub">{t("screener.noCandidates")}</span>}
      </div>
      {toLoad.length > BIG_RUN && progress === null && <p className="sub" style={{ fontSize: 12 }}>{t("screener.bigRun", { n: toLoad.length })}</p>}

      <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
        <span className="sub">{t("screener.addCompany")}</span>
        <SymbolSearch placeholder={t("screener.addCompanyPlaceholder")} onPick={(s) => void addCompany(s)} />
        {adding && <span className="sub">{t("common.loading")}</span>}
      </div>
      <details style={{ marginBottom: 8 }}>
        <summary>{t("screener.fullList", { shown: toLoad.length, total: universe.length })}</summary>
        <div className="scroll-x" style={{ maxHeight: 280, overflowY: "auto" }}>
          <table aria-label={t("screener.listTable")}>
            <thead><tr><th>{t("common.symbol")}</th><th>{t("screener.col.name")}</th><th>{t("screener.sector")}</th><th>{t("screener.industry")}</th><th>{t("screener.country")}</th><th /></tr></thead>
            <tbody>
              {toLoad.map((u) => (
                <tr key={u.symbol}>
                  <td><Link className="sym" href={`/stock?s=${u.symbol}`}>{u.symbol}</Link></td>
                  <td>{u.name}</td><td className="sub">{ts(u.sector)}</td><td className="sub">{ts(u.industry)}</td><td className="sub">{ts(u.country)}</td>
                  <td style={{ textAlign: "end" }}>{custom.some((c) => c.symbol === u.symbol) && <button className="btn sm ghost" onClick={() => removeCompany(u.symbol)}>{t("common.remove")}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {status && <p className="sub" role="status">{status}</p>}

      {rows && (
        <>
          {isSampleData(source) && <div className="err" style={{ marginBottom: 8 }}>{t("screener.sample")}</div>}
          {stopped && (
            <p className="sub" role="status">
              {t(stopped.cancelled ? "screener.stoppedByUser" : "screener.stoppedFeed", { n: stopped.notLoaded })}{" "}
              {stopped.notLoaded > 0 && <button className="btn sm" onClick={() => void load(toLoad.map((u) => u.symbol).filter((s) => !rows.some((r) => r.symbol === s)), true)}>{t("screener.loadRest", { n: stopped.notLoaded })}</button>}
            </p>
          )}
          {failed > 0 && (
            <p className="sub">
              {t("screener.failed", { n: failed })}{busy > 0 && ` ${t("screener.failedBusy", { n: busy })}`}{" "}
              <button className="btn sm" disabled={progress !== null} onClick={() => void load(failedRows.map((r) => r.symbol), true)}>{t("screener.retry", { n: failed })}</button>
            </p>
          )}
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="sub">{t("screener.count", { shown: shown.length, total: rows.length })}</span>
            <span className="row" style={{ flex: "0 1 auto" }}>
              <button className="btn sm" disabled={picked.size === 0} onClick={() => void add([...picked])}>{t("screener.addPicked", { n: picked.size })}</button>
              <button className="btn sm" disabled={addable.length === 0} onClick={() => void add(addable.map((r) => r.symbol))}>{t("screener.addAll", { n: addable.length })}</button>
            </span>
          </div>
          <div className="scroll-x">
            <table aria-label={t("screener.resultsTable")}>
              <thead>
                <tr>
                  <th />{header("symbol", "common.symbol")}<th>{t("screener.sector")}</th>{header("price", "common.price")}
                  {header("perf_1m", "screener.col.1m")}{header("perf_3m", "screener.col.3m")}{header("perf_12m", "screener.col.12m")}
                  {header("momentum", "screener.col.momentum")}{header("pct_from_high", "screener.col.fromHigh")}{header("pct_from_low", "screener.col.fromLow")}
                  {header("volatility_pct", "screener.col.volatility")}{header("pe", "screener.col.pe")}<th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const u = byId.get(r.symbol);
                  const on = watched.has(r.symbol);
                  return (
                    <tr key={r.symbol}>
                      <td><input type="checkbox" aria-label={r.symbol} disabled={on} checked={picked.has(r.symbol)}
                        onChange={(e) => setPicked(new Set(e.target.checked ? [...picked, r.symbol] : [...picked].filter((s) => s !== r.symbol)))} /></td>
                      <td><Link className="sym" href={`/stock?s=${r.symbol}`}>{r.symbol}</Link> <span className="sub" style={{ fontSize: 11 }}>{u?.name}</span></td>
                      <td className="sub">{u ? ts(u.sector) : ""}</td>
                      <td className="n">{money(r.price)}</td>
                      <td className={`n ${tone(r.perf_1m)}`}>{pct(r.perf_1m)}</td>
                      <td className={`n ${tone(r.perf_3m)}`}>{pct(r.perf_3m)}</td>
                      <td className={`n ${tone(r.perf_12m)}`}>{pct(r.perf_12m)}</td>
                      <td className={`n ${tone(r.momentum)}`}>{pct(r.momentum)}</td>
                      <td className="n">{pct(r.pct_from_high)}</td>
                      <td className="n">{pct(r.pct_from_low)}</td>
                      <td className="n">{share(r.volatility_pct, 1)}</td>
                      <td className="n">{r.pe == null ? "—" : r.pe.toFixed(1)}</td>
                      <td style={{ textAlign: "end" }}>
                        {on ? <span className="sub">{t("screener.watching")}</span> : <button className="btn sm" onClick={() => void add([r.symbol])}>{t("common.add")}</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <div className="empty">{t("screener.none")}</div>}
          <p className="sub" style={{ fontSize: 12 }}>{t("screener.note")}</p>
        </>
      )}
    </div>
  );
}
