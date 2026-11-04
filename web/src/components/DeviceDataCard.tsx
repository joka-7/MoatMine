"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { ImportError } from "@/lib/store";
import { portfolioStore } from "@/lib/store/shared";

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The local-mode switch, with export and import of the on-device data as one JSON file. */
export default function DeviceDataCard() {
  const { t } = useI18n();
  const { on, ready, choose } = useLocalMode();
  const [status, setStatus] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const guarded = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      const detail = e instanceof ImportError ? e.problems.join("; ") : (e as Error).message;
      setStatus(t(e instanceof ImportError ? "device.importFailed" : "device.unavailable", { error: detail }));
    }
  };

  const toggle = (next: boolean) => guarded(async () => {
    if (next) await portfolioStore(); // fail here, not on the first save, if the browser cannot store data
    choose(next);
    setStatus("");
  });

  const exportData = () => guarded(async () => {
    const data = await (await portfolioStore()).exportAll();
    download(`moatmine-${data.exportedAt.slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  });

  const importData = (f: File) => guarded(async () => {
    const summary = await (await portfolioStore()).importAll(JSON.parse(await f.text()), "merge");
    setStatus(t("device.imported", { ...summary }));
  });

  return (
    <div className="card">
      <h2>{t("device.title")}</h2>
      <p className="sub">{t("device.body")}</p>
      <p className="sub">{t("device.limits")}</p>
      <label className="row" style={{ alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={on} disabled={!ready} onChange={(e) => toggle(e.target.checked)} />
        {t("device.toggle")}
      </label>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={exportData}>{t("device.export")}</button>
        <button className="btn" onClick={() => file.current?.click()}>{t("device.import")}</button>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
      </div>
      {status && <p className="sub" role="status" style={{ marginTop: 8 }}>{status}</p>}
    </div>
  );
}
