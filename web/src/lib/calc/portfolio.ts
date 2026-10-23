import type { Account, HoldingRow, Portfolio } from "../api";
import { pyRound } from "./round";
import type { BookMode, CalcAccount, CalcHolding, CalcQuote } from "./types";

export const PAPER_BROKER = "paper";

/** The accounts of one book: practice (paper) money and real money are never mixed. */
export function accountsInBook<A extends { readonly broker: string }>(accounts: readonly A[], mode: BookMode): A[] {
  return accounts.filter((a) => (a.broker === PAPER_BROKER) === (mode === "paper"));
}

/**
 * Price one book's holdings with the given quotes and total them. A holding with no quote is
 * valued at what was paid and listed under `totals.unpriced`.
 *
 * Twin of `build_snapshot` in `backend/app/portfolio.py`; `backend/tests/vectors/calc.json` checks both.
 */
export function buildSnapshot(
  mode: BookMode,
  accounts: readonly CalcAccount[],
  holdings: readonly CalcHolding[],
  quotes: Readonly<Record<string, CalcQuote | undefined>>,
): Portfolio {
  let totalCost = 0;
  let totalValue = 0;
  let dayChange = 0;
  const rows = holdings.map((h) => {
    const q = quotes[h.symbol];
    const price = q ? q.price : h.avg_cost;
    const cost = h.quantity * h.avg_cost;
    const value = h.quantity * price;
    totalCost += cost;
    totalValue += value;
    if (q) dayChange += h.quantity * q.change;
    return {
      id: h.id,
      account_id: h.account_id,
      symbol: h.symbol,
      quantity: h.quantity,
      avg_cost: h.avg_cost,
      price,
      value: pyRound(value),
      cost: pyRound(cost),
      pnl: pyRound(value - cost),
      pnl_pct: cost ? pyRound((value / cost - 1) * 100) : 0,
      day_change_pct: q ? q.change_pct : 0,
      opened_at: h.opened_at,
      stale: q === undefined,
    };
  });

  const cash = accounts.reduce((sum, a) => sum + a.cash, 0);
  const weighted: HoldingRow[] = rows.map((r) => ({ ...r, weight_pct: totalValue ? pyRound((r.value / totalValue) * 100) : 0 }));
  const unpriced = [...new Set(rows.filter((r) => r.stale).map((r) => r.symbol))].sort();

  return {
    mode,
    accounts: accounts.map((a): Account => ({ id: a.id, name: a.name, broker: a.broker, currency: a.currency, cash: a.cash })),
    holdings: weighted.sort((a, b) => b.value - a.value),
    totals: {
      cash: pyRound(cash),
      invested_value: pyRound(totalValue),
      net_worth: pyRound(totalValue + cash),
      cost: pyRound(totalCost),
      pnl: pyRound(totalValue - totalCost),
      pnl_pct: totalCost ? pyRound((totalValue / totalCost - 1) * 100) : 0,
      day_change: pyRound(dayChange),
      unpriced,
    },
  };
}
