/**
 * Whether a result was built from sample prices: the mock provider ("mock") or Finnhub's
 * fallback when its candle endpoint is unavailable ("mock-fallback"). Anything shown from
 * sample data must say so.
 */
export function isSampleData(source: string | null | undefined): boolean {
  return source?.startsWith("mock") ?? false;
}
