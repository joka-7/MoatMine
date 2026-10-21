"use client";

import { AreaSeries, ColorType, UTCTimestamp, createChart, IChartApi } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { apiWithHeaders } from "@/lib/api";
import type { BookMode } from "@/lib/useBookMode";
import { isSampleData } from "@/lib/dataSource";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { CANVAS_COLORS, useTheme } from "@/lib/theme";

const SPANS = [30, 90, 180, 365, 1095] as const;
const LABEL: Record<(typeof SPANS)[number], MessageKey> = {
  30: "dashboard.chart.1m", 90: "dashboard.chart.3m", 180: "dashboard.chart.6m", 365: "dashboard.chart.1y", 1095: "dashboard.chart.3y",
};

export default function ValueChart({ mode }: { mode: BookMode }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const C = CANVAS_COLORS[theme];
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [days, setDays] = useState<number>(180);
  const [points, setPoints] = useState<{ t: number; value: number }[] | null>(null);
  const [source, setSource] = useState("");

  useEffect(() => {
    let current = true; // drop the response if days/mode changed before it arrived
    setPoints(null); // and don't keep drawing the previous book's line meanwhile
    apiWithHeaders<{ t: number; value: number }[]>(`/portfolio/history?days=${days}&mode=${mode}`)
      .then(({ data, headers }) => { if (current) { setPoints(data); setSource(headers.get("X-Data-Source") ?? ""); } })
      .catch(() => { if (current) setPoints([]); });
    return () => { current = false; };
  }, [days, mode]);

  useEffect(() => {
    if (!el.current || !points?.length) return;
    const chart = createChart(el.current, {
      autoSize: true,
      height: 260,
      // fixed locale: the default (navigator.language) can be "en-US@posix" on Linux/C locales, which Intl rejects
      localization: { locale: "en-US" },
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: C.text },
      grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    chartRef.current = chart;
    const up = points[points.length - 1].value >= points[0].value;
    const line = up ? C.up : C.down;
    chart
      .addSeries(AreaSeries, { lineColor: line, topColor: `rgba(${up ? C.upFill : C.downFill},.22)`, bottomColor: "rgba(0,0,0,0)", lineWidth: 2 })
      .setData(points.map((p) => ({ time: p.t as UTCTimestamp, value: p.value })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points, C]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t("dashboard.chart.title")}</h2>
        <div className="seg" style={{ flex: "0 1 auto" }}>
          {SPANS.map((d) => (
            <button key={d} className={`btn sm ${d === days ? "on" : ""}`} onClick={() => setDays(d)}>{t(LABEL[d])}</button>
          ))}
        </div>
      </div>
      {points && !points.length ? <div className="empty">{t("dashboard.chart.empty")}</div> : <div ref={el} style={{ height: 260 }} />}
      <div className="sub" style={{ fontSize: 12 }}>{t(isSampleData(source) ? "dashboard.chart.noteSample" : "dashboard.chart.note")}</div>
    </div>
  );
}
