"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { HoldingRow } from "@/lib/api";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const COLORS = ["#e8b04a", "#6aa5ff", "#49c58c", "#b58cff", "#ec6650", "#4fd1c5", "#f2c879", "#8b909a"];

export default function AllocationPie({ holdings, cash }: { holdings: HoldingRow[]; cash: number }) {
  const { t } = useI18n();
  const data = [
    ...holdings.map((h) => ({ name: h.symbol, value: h.value })),
    ...(cash > 0 ? [{ name: t("common.cash"), value: cash }] : []),
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="empty">{t("dashboard.allocation.empty")}</div>;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 180, height: 180 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} stroke="none" paddingAngle={1}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              formatter={(v: number) => money(v)}
              contentStyle={{ background: "#14171c", border: "1px solid #262a32", borderRadius: 8 }}
              itemStyle={{ color: "#ece8df" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], marginInlineEnd: 8 }} />{d.name}</span>
            <span className="num">{((d.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
