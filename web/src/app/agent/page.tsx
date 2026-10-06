"use client";

import ChatPanel from "@/components/ChatPanel";

export default function AgentPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>AI agent</h1>
          <div className="sub">Auto-dispatch picks a fast or strong model per question. Use your own keys or an external agent in Settings.</div>
        </div>
      </div>
      <ChatPanel
        height={560}
        suggestions={["How is my portfolio doing?", "Which targets are out of range?", "Compare my top two holdings", "What's moving on my watchlist?"]}
      />
    </>
  );
}
