"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  LineSeries,
  UTCTimestamp,
  createChart,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { apiWithHeaders, Candle } from "@/lib/api";
import { isSampleData } from "@/lib/dataSource";
import { useI18n } from "@/lib/i18n";

const RANGES = [
  { id: "1D", res: "5", days: 1, unit: "stock.range.days", n: 1 },
  { id: "5D", res: "15", days: 5, unit: "stock.range.days", n: 5 },
  { id: "1M", res: "60", days: 30, unit: "stock.range.months", n: 1 },
  { id: "6M", res: "D", days: 182, unit: "stock.range.months", n: 6 },
  { id: "1Y", res: "D", days: 365, unit: "stock.range.years", n: 1 },
  { id: "5Y", res: "W", days: 1825, unit: "stock.range.years", n: 5 },
] as const;

const C = { up: "#49c58c", down: "#ec6650", text: "#8b909a", grid: "#1d2128", accent: "#e8b04a", blue: "#6aa5ff" };

function sma(bars: Candle[], n: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.c;
    if (i >= n) sum -= bars[i - n].c;
    if (i >= n - 1) out.push({ time: b.t as UTCTimestamp, value: +(sum / n).toFixed(2) });
  });
  return out;
}

export default function PriceChart({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[4]);
  const [kind, setKind] = useState<"candle" | "line">("candle");
  const [overlays, setOverlays] = useState({ sma20: true, sma50: false, volume: true });
  const [bars, setBars] = useState<Candle[]>([]);
  const [source, setSource] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - range.days * 86400;
    let cancelled = false;
    (async () => {
      try {
        const { data, headers } = await apiWithHeaders<Candle[]>(
          `/stocks/${symbol}/candles?resolution=${range.res}&start=${start}&end=${end}`,
        );
        if (!cancelled) { setBars(data); setSource(headers.get("X-Data-Source") || ""); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, range]);

  useEffect(() => {
    if (!el.current || !bars.length) return;
    const chart = createChart(el.current, {
      autoSize: true,
      height: 420,
      // fixed locale: the default (navigator.language) can be "en-US@posix" on Linux/C locales, which Intl rejects
      localization: { locale: "en-US" },
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: C.text, fontFamily: "ui-monospace, Menlo, monospace" },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: C.grid },
      timeScale: { borderColor: C.grid, timeVisible: range.res !== "D" && range.res !== "W", rightOffset: 4 },
      handleScroll: true,
      handleScale: true, // mouse wheel / pinch zoom, drag to pan
    });
    chartRef.current = chart;

    if (kind === "candle") {
      chart.addSeries(CandlestickSeries, {
        upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down,
      }).setData(bars.map((b) => ({ time: b.t as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c })));
    } else {
      chart.addSeries(AreaSeries, {
        lineColor: C.accent, topColor: "rgba(232,176,74,0.25)", bottomColor: "rgba(232,176,74,0)", lineWidth: 2,
      }).setData(bars.map((b) => ({ time: b.t as UTCTimestamp, value: b.c })));
    }
    if (overlays.sma20) chart.addSeries(LineSeries, { color: C.blue, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(sma(bars, 20));
    if (overlays.sma50) chart.addSeries(LineSeries, { color: "#b58cff", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(sma(bars, 50));
    if (overlays.volume) {
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(bars.map((b) => ({ time: b.t as UTCTimestamp, value: b.v, color: b.c >= b.o ? "rgba(73,197,140,0.35)" : "rgba(236,102,80,0.35)" })));
    }
    chart.timeScale().fitContent();
    return () => { chart.remove(); chartRef.current = null; };
  }, [bars, kind, overlays, range.res]);

  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const mid = (r.from + r.to) / 2;
    const half = Math.max(5, ((r.to - r.from) / 2) * factor);
    ts.setVisibleLogicalRange({ from: mid - half, to: mid + half });
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.id} className={`btn sm ${r.id === range.id ? "on" : ""}`} onClick={() => setRange(r)}>{t(r.unit, { n: r.n })}</button>
          ))}
        </div>
        <div className="seg">
          <button className={`btn sm ${kind === "candle" ? "on" : ""}`} onClick={() => setKind("candle")}>{t("stock.chart.candles")}</button>
          <button className={`btn sm ${kind === "line" ? "on" : ""}`} onClick={() => setKind("line")}>{t("stock.chart.line")}</button>
          {(["sma20", "sma50", "volume"] as const).map((k) => (
            <button key={k} className={`btn sm ${overlays[k] ? "on" : ""}`} onClick={() => setOverlays((o) => ({ ...o, [k]: !o[k] }))}>
              {k === "volume" ? t("stock.chart.volume") : k.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className="btn sm" title={t("stock.chart.zoomIn")} onClick={() => zoom(0.6)}>＋</button>
          <button className="btn sm" title={t("stock.chart.zoomOut")} onClick={() => zoom(1.6)}>－</button>
          <button className="btn sm" title={t("stock.chart.reset")} onClick={() => chartRef.current?.timeScale().fitContent()}>{t("stock.chart.fit")}</button>
        </div>
      </div>
      {err ? <div className="err">{err}</div> : <div ref={el} style={{ height: 420 }} />}
      {source && source !== "finnhub" && (
        <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>
          {t(isSampleData(source) ? "stock.chart.sourceSample" : "stock.chart.source", { source })}
        </div>
      )}
    </div>
  );
}
