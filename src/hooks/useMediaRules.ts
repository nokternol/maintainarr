import type { ContentTypeSchema } from '@app/lib/api/schemas';
import useSWR from 'swr';
import type { z } from 'zod';

type ContentType = z.infer<typeof ContentTypeSchema>;

export interface MediaRuleDescriptor {
  key: string;
  label: string;
  contentTypes: ContentType[];
  dataType: 'boolean' | 'number' | 'string' | 'csv-ids' | 'csv-strings' | 'range';
  sourceProviders: string[];
  required: boolean;
}

const KEY = '/api/filter-fields';

async function fetcher(url: string): Promise<MediaRuleDescriptor[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch filter fields');
  return res.json();
}

export function useMediaRules(contentType?: ContentType): {
  rules: MediaRuleDescriptor[] | undefined;
  isLoading: boolean;
} {
  const key = contentType ? `${KEY}?contentType=${contentType}` : KEY;
  const { data, isLoading } = useSWR<MediaRuleDescriptor[]>(key, fetcher);
  return { rules: data, isLoading };
}
