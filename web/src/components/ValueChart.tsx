"use client";

import { AreaSeries, ColorType, UTCTimestamp, createChart, IChartApi } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { BookMode } from "@/lib/useBookMode";

const SPANS = [30, 90, 180, 365, 1095] as const;
const LABEL: Record<number, string> = { 30: "1M", 90: "3M", 180: "6M", 365: "1Y", 1095: "3Y" };

export default function ValueChart({ mode }: { mode: BookMode }) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [days, setDays] = useState<number>(180);
  const [points, setPoints] = useState<{ t: number; value: number }[] | null>(null);

  useEffect(() => {
    api<{ t: number; value: number }[]>(`/portfolio/history?days=${days}&mode=${mode}`).then(setPoints).catch(() => setPoints([]));
  }, [days, mode]);

  useEffect(() => {
    if (!el.current || !points?.length) return;
    const chart = createChart(el.current, {
      autoSize: true,
      height: 260,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b909a" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#1d2128" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    chartRef.current = chart;
    const up = points[points.length - 1].value >= points[0].value;
    const line = up ? "#49c58c" : "#ec6650";
    chart
      .addSeries(AreaSeries, { lineColor: line, topColor: up ? "rgba(73,197,140,.22)" : "rgba(236,102,80,.22)", bottomColor: "rgba(0,0,0,0)", lineWidth: 2 })
      .setData(points.map((p) => ({ time: p.t as UTCTimestamp, value: p.value })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Holdings value</h2>
        <div className="seg" style={{ flex: 0 }}>
          {SPANS.map((d) => (
            <button key={d} className={`btn sm ${d === days ? "on" : ""}`} onClick={() => setDays(d)}>{LABEL[d]}</button>
          ))}
        </div>
      </div>
      {points && !points.length ? <div className="empty">Add holdings to see value over time.</div> : <div ref={el} style={{ height: 260 }} />}
      <div className="sub" style={{ fontSize: 12 }}>Current quantities priced historically. Scroll to zoom, drag to pan.</div>
    </div>
  );
}
