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

const SORTS: readonly (readonly [SortKey, MessageKey])[] = [
  ["perf_3m", "screener.col.3m"], ["perf_1m", "screener.col.1m"], ["perf_12m", "screener.col.12m"], ["momentum", "screener.col.momentum"],
  ["pct_from_high", "screener.col.fromHigh"], ["pct_from_low", "screener.col.fromLow"], ["volatility_pct", "screener.col.volatility"],
  ["pe", "screener.col.pe"], ["price", "common.price"], ["symbol", "common.symbol"],
];

function Choice({ label, options, chosen, show, onChange }: { label: string; options: readonly string[]; chosen: readonly string[]; show: (v: string) => string; onChange: (next: string[]) => void }) {
  return (
    <details className="scr-choice">
      <summary>
        <span>{label}</span>
        {chosen.length > 0 && <span className="chip ok">{chosen.length}</span>}
      </summary>
      <div className="scr-options">
        {options.map((o) => (
          <label key={o}>
            <input type="checkbox" checked={chosen.includes(o)} onChange={(e) => onChange(e.target.checked ? [...chosen, o] : chosen.filter((c) => c !== o))} />
            {show(o)}
          </label>
        ))}
      </div>
    </details>
  );
}

function Stat({ label, value, kind = "" }: { label: string; value: string; kind?: string }) {
  return <div className="scr-stat"><span>{label}</span><b className={kind}>{value}</b></div>;
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

  const field = (key: keyof Draft, label: MessageKey, step = "any") => (
    <label className="f">{t(label)}
      <input type="number" inputMode="decimal" step={step} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="card scr" style={{ marginBottom: 16 }}>
      <h2>{t("screener.title")}</h2>
      <p className="sub">{t("screener.intro", { n: universe.length })}</p>

      <section className="scr-step">
        <h3><i>1</i>{t("screener.step.where")}</h3>
        <div className="scr-grid">
          <Choice label={t("screener.sector")} options={sectors} chosen={where.sectors} show={ts}
            onChange={(sectors) => setWhere({ ...where, sectors, industries: [] })} />
          <Choice label={t("screener.industry")} options={industries} chosen={where.industries} show={ts} onChange={(next) => setWhere({ ...where, industries: next })} />
          <Choice label={t("screener.country")} options={countries} chosen={where.countries} show={ts} onChange={(next) => setWhere({ ...where, countries: next })} />
        </div>
        <details className="scr-list">
          <summary>{t("screener.fullList", { shown: toLoad.length, total: universe.length })}</summary>
          <div className="scroll-x scr-listbox">
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
        <div className="scr-add">
          <span className="sub">{t("screener.addCompany")}</span>
          <SymbolSearch placeholder={t("screener.addCompanyPlaceholder")} onPick={(s) => void addCompany(s)} />
          {adding && <span className="sub">{t("common.loading")}</span>}
        </div>
      </section>

      <section className="scr-step">
        <h3><i>2</i>{t("screener.step.what")}</h3>
        <div className="seg scr-presets">
          {PRESET_LABELS.map(([key, label]) => <button key={key} className="btn sm" onClick={() => applyPreset(key)}>{t(label)}</button>)}
          <button className="btn sm ghost" onClick={() => { setDraft(BLANK); setAboveSma200(false); }}>{t("screener.clear")}</button>
        </div>
        <div className="scr-groups">
          <fieldset>
            <legend>{t("screener.group.value")}</legend>
            {field("maxPe", "screener.maxPe")}
            {field("maxVolatility", "screener.maxVolatility")}
            {field("maxDrawdown", "screener.maxDrawdown")}
          </fieldset>
          <fieldset>
            <legend>{t("screener.group.performance")}</legend>
            <label className="f">{t("screener.perfWindow")}
              <select value={perfWindow} onChange={(e) => setPerfWindow(e.target.value as PerfWindow)}>
                {WINDOWS.map(([w, label]) => <option key={w} value={w}>{t(label)}</option>)}
              </select>
            </label>
            {field("minPerf", "screener.minPerf")}
            {field("maxPerf", "screener.maxPerf")}
            {field("minMomentum", "screener.minMomentum")}
          </fieldset>
          <fieldset>
            <legend>{t("screener.group.range")}</legend>
            {field("nearHigh", "screener.nearHigh")}
            {field("nearLow", "screener.nearLow")}
            <label className="scr-toggle">
              <input type="checkbox" checked={aboveSma200} onChange={(e) => setAboveSma200(e.target.checked)} />{t("screener.aboveSma200")}
            </label>
          </fieldset>
        </div>
      </section>

      <section className="scr-step">
        <h3><i>3</i>{t("screener.step.load")}</h3>
        <div className="scr-actions">
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
        {progress !== null && <div className="bar" aria-hidden><span style={{ width: `${toLoad.length ? Math.min(100, (progress / toLoad.length) * 100) : 0}%` }} /></div>}
      </section>
      {status && <p className="sub" role="status">{status}</p>}

      {rows && (
        <section className="scr-step">
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
          <div className="scr-bar">
            <span className="sub">{t("screener.count", { shown: shown.length, total: rows.length })}</span>
            <label className="scr-sort">{t("screener.sortBy")}
              <select value={sort.key} onChange={(e) => setSort({ ...sort, key: e.target.value as SortKey })}>
                {SORTS.map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
              </select>
            </label>
            <button className="btn sm" aria-label={t("screener.direction")} onClick={() => setSort({ ...sort, direction: sort.direction === "desc" ? "asc" : "desc" })}>
              {sort.direction === "desc" ? `▼ ${t("screener.highFirst")}` : `▲ ${t("screener.lowFirst")}`}
            </button>
            <span className="scr-bulk">
              <button className="btn sm" disabled={picked.size === 0} onClick={() => void add([...picked])}>{t("screener.addPicked", { n: picked.size })}</button>
              <button className="btn sm" disabled={addable.length === 0} onClick={() => void add(addable.map((r) => r.symbol))}>{t("screener.addAll", { n: addable.length })}</button>
            </span>
          </div>
          <ul className="scr-cards" aria-label={t("screener.resultsTable")}>
            {shown.map((r) => {
              const u = byId.get(r.symbol);
              const on = watched.has(r.symbol);
              return (
                <li key={r.symbol} className="scr-card">
                  <header>
                    <input type="checkbox" aria-label={r.symbol} disabled={on} checked={picked.has(r.symbol)}
                      onChange={(e) => setPicked(new Set(e.target.checked ? [...picked, r.symbol] : [...picked].filter((s) => s !== r.symbol)))} />
                    <div className="scr-id">
                      <Link className="sym" href={`/stock?s=${r.symbol}`}>{r.symbol}</Link>
                      <span className="sub">{u?.name}</span>
                    </div>
                    <b className="num">{money(r.price)}</b>
                  </header>
                  {u && <p className="sub scr-where">{ts(u.sector)} · {ts(u.country)}</p>}
                  <div className="scr-stats">
                    <Stat label={t("screener.col.1m")} value={pct(r.perf_1m)} kind={tone(r.perf_1m)} />
                    <Stat label={t("screener.col.3m")} value={pct(r.perf_3m)} kind={tone(r.perf_3m)} />
                    <Stat label={t("screener.col.12m")} value={pct(r.perf_12m)} kind={tone(r.perf_12m)} />
                    <Stat label={t("screener.col.momentum")} value={pct(r.momentum)} kind={tone(r.momentum)} />
                    <Stat label={t("screener.col.fromHigh")} value={pct(r.pct_from_high)} />
                    <Stat label={t("screener.col.fromLow")} value={pct(r.pct_from_low)} />
                    <Stat label={t("screener.col.volatility")} value={share(r.volatility_pct, 1)} />
                    <Stat label={t("screener.col.pe")} value={r.pe == null ? "—" : r.pe.toFixed(1)} />
                  </div>
                  <footer>
                    {on ? <span className="chip ok">{t("screener.watching")}</span> : <button className="btn sm" onClick={() => void add([r.symbol])}>{t("common.add")}</button>}
                  </footer>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <div className="empty">{t("screener.none")}</div>}
          <p className="sub" style={{ fontSize: 12 }}>{t("screener.note")}</p>
        </section>
      )}
    </div>
  );
}
