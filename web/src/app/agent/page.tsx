"use client";

import ChatPanel from "@/components/ChatPanel";
import { useI18n, type MessageKey } from "@/lib/i18n";

const SUGGESTIONS: readonly MessageKey[] = ["ai.suggestPortfolio", "ai.suggestTargets", "ai.suggestCompare", "ai.suggestWatchlist"];

export default function AgentPage() {
  const { t } = useI18n();
  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t("ai.agentTitle")}</h1>
          <div className="sub">{t("ai.agentIntro")}</div>
        </div>
      </div>
      <ChatPanel
        height={560}
        suggestions={SUGGESTIONS.map((k) => t(k))}
      />
    </>
  );
}
