"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { SignOutLink } from "./AuthShell";

const LINKS: readonly (readonly [string, MessageKey])[] = [
  ["/", "nav.dashboard"],
  ["/portfolio", "nav.portfolio"],
  ["/watchlist", "nav.watchlist"],
  ["/risk", "nav.risk"],
  ["/plans", "nav.plans"],
  ["/targets", "nav.targets"],
  ["/agent", "nav.agent"],
];

export default function Nav() {
  const { t } = useI18n();
  const path = usePathname().replace(/\/$/, "") || "/";
  const cls = (href: string) => `navlink${path === href ? " active" : ""}`;
  return (
    <nav className="side">
      <div className="brand"><i /> MoatMine</div>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={cls(href)}>{t(label)}</Link>
      ))}
      <div className="grow" />
      <Link href="/risk-profile" className={cls("/risk-profile")}>{t("nav.riskProfile")}</Link>
      <Link href="/settings" className={cls("/settings")}>{t("nav.settings")}</Link>
      <SignOutLink />
    </nav>
  );
}
