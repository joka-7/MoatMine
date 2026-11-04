import { openPortfolioStore } from "./index";
import type { PortfolioStore } from "./types";

let opened: Promise<PortfolioStore> | null = null;

/** The one store for this page load; a failed open is retried on the next call. */
export function portfolioStore(): Promise<PortfolioStore> {
  opened ??= openPortfolioStore().catch((e: unknown) => {
    opened = null;
    throw e;
  });
  return opened;
}
