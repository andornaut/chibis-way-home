// The build's limit on files read at once, so a build stays under low open-file limits.
export const FILE_READ_CONCURRENCY = 16;

// Maps every item through mapper with at most limit calls pending at a time, resolving to the
// results in the items' order, or rejecting with the first error.
export async function mapBounded<Item, Result>(
  limit: number,
  mapper: (item: Item) => Promise<Result>,
  items: readonly Item[],
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    if (next >= items.length) {
      return;
    }
    const index = next;
    next += 1;
    results[index] = await mapper(items[index] as Item);
    await worker();
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
