/**
 * Maps `items` with at most `limit` calls in flight, preserving order.
 *
 * Firing thousands of fs calls at once (e.g. `Promise.all` over a big folder)
 * dispatches them all in one synchronous burst and blocks the event loop;
 * a small pool spreads the work across ticks.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
