/**
 * Round to `digits` places the way Python's `round()` does: to the nearest, and on an exact tie to
 * the even neighbour (`round(0.125, 2)` is 0.12, where `toFixed` gives 0.13). The Python backend
 * rounds every figure this way, so the on-device maths must match it to the cent.
 */
export function pyRound(x: number, digits = 2): number {
  if (!Number.isFinite(x)) return x;
  const exact = Math.abs(x).toFixed(digits + 40); // a double's decimal expansion is exact this far for any amount a portfolio holds
  const kept = exact.slice(0, exact.length - 40);
  const rest = exact.slice(exact.length - 40);
  const tie = /^50*$/.test(rest);
  const lastKeptDigit = Number(kept.replace(".", "").slice(-1));
  const rounded = tie && lastKeptDigit % 2 === 0 ? Number(kept) : Number(Math.abs(x).toFixed(digits));
  const signed = x < 0 ? -rounded : rounded;
  return signed === 0 ? 0 : signed; // never -0: it would not equal 0 in a deep comparison
}
