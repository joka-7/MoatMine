"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Dashboard"],
  ["/portfolio", "Portfolio"],
  ["/watchlist", "Watchlist"],
  ["/risk", "Risk"],
  ["/plans", "Buy plans"],
  ["/targets", "Targets · PAPI"],
  ["/agent", "AI agent"],
] as const;

export default function Nav() {
  const path = usePathname().replace(/\/$/, "") || "/";
  const cls = (href: string) => `navlink${path === href ? " active" : ""}`;
  return (
    <nav className="side">
      <div className="brand"><i /> Moatrics</div>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={cls(href)}>{label}</Link>
      ))}
      <div className="grow" />
      <Link href="/risk-profile" className={cls("/risk-profile")}>Risk profile</Link>
      <Link href="/settings" className={cls("/settings")}>Settings</Link>
    </nav>
  );
}
