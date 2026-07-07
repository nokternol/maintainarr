import type { ContentTypeSchema } from "@app/lib/api/schemas";
import useSWR from "swr";
import type { z } from "zod";
import type { FetchResponse } from "@app/types/fetch";

type ContentType = z.infer<typeof ContentTypeSchema>;

/** One content type's ownership as projected by GET /api/media/sources. */
export interface MediaSourceDescriptor {
    contentType: ContentType;
    ownerType: string;
    configured: boolean;
}

const KEY = "/api/media/sources";

async function fetcher(url: string): Promise<MediaSourceDescriptor[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch media sources");
    const json = await res.json<FetchResponse<MediaSourceDescriptor[]>>();
    return json.data;
}

export function useMediaSources(): {
    sources: Record<ContentType, MediaSourceDescriptor> | undefined;
    isLoading: boolean;
} {
    const { data, isLoading } = useSWR<MediaSourceDescriptor[]>(KEY, fetcher);
    const sources = data
        ? (Object.fromEntries(data.map((d) => [d.contentType, d])) as Record<
              ContentType,
              MediaSourceDescriptor
          >)
        : undefined;
    return { sources, isLoading };
}
