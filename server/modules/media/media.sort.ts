/**
 * Orders a media list by the `<field>_<asc|desc>` sort param shared by the movie
 * and series browse routes. `statusOf` supplies the boolean "availability" key —
 * `hasFile` for movies, `monitored` for series — that the `status` field sorts on.
 * Returns a new array; the input is left untouched.
 */
export function sortMedia<T extends { title: string; year?: number }>(
  items: T[],
  sort: string,
  statusOf: (item: T) => boolean
): T[] {
  const dir = sort.endsWith('_desc') ? -1 : 1;
  const field = sort.replace(/_(?:asc|desc)$/, '');
  return items.slice().sort((a, b) => {
    if (field === 'year') return dir * ((a.year ?? 0) - (b.year ?? 0));
    if (field === 'status') return dir * (Number(statusOf(a)) - Number(statusOf(b)));
    return dir * a.title.localeCompare(b.title);
  });
}
