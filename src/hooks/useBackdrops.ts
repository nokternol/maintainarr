//@ts-ignore
import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => d.data);

export const useBackdrops = () => {
  const { data: backdrops } = useSWR<string[]>('/api/backdrops', fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  return { backdrops };
};
