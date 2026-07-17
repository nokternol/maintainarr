import useSWRMutation from 'swr/mutation';

const KEY = '/api/media/reset';

async function resetMedia(url: string): Promise<{ deletedIdentities: number }> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to reset media data');
  const json = (await res.json()) as { data: { deletedIdentities: number } };
  return json.data;
}

export function useMediaReset() {
  const { trigger, isMutating } = useSWRMutation(KEY, resetMedia);
  return { reset: trigger, isResetting: isMutating };
}
