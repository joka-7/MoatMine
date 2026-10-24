import { pyRound } from "./round";

/** Python's `f"{x:.{digits}f}"`: ties go to the even digit and a negative that rounds to zero keeps its sign. */
export function fixed(x: number, digits: number): string {
  const body = pyRound(Math.abs(x), digits).toFixed(digits);
  return x < 0 ? `-${body}` : body;
}

/** Python's `f"{x:,.0f}"`. */
export function groupedWhole(x: number): string {
  const body = fixed(x, 0);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Python's `f"{x:g}"` for the magnitudes the risk rules use (below a million): six significant digits, no trailing zeros. */
export function general(x: number): string {
  return String(Number(x.toPrecision(6)));
}
