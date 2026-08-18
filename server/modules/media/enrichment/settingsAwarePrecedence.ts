import { MetadataProviderType } from '../../../database/schema';
import type { ContestedFieldPrecedence, EnrichableField } from './precedence';

/**
 * Swaps PLEX and JELLYFIN's positions within each field's order, wherever
 * both appear — every other provider in the order keeps its relative
 * position. Fields with only one (or neither) of the two are unaffected.
 */
export function applyPrimaryMediaServer(
  base: ContestedFieldPrecedence,
  primaryMediaServer: 'PLEX' | 'JELLYFIN'
): ContestedFieldPrecedence {
  const primary =
    primaryMediaServer === 'PLEX' ? MetadataProviderType.PLEX : MetadataProviderType.JELLYFIN;
  const secondary =
    primaryMediaServer === 'PLEX' ? MetadataProviderType.JELLYFIN : MetadataProviderType.PLEX;

  const result: ContestedFieldPrecedence = {};
  for (const [field, order] of Object.entries(base) as [
    EnrichableField,
    readonly MetadataProviderType[],
  ][]) {
    const hasBoth =
      order.includes(MetadataProviderType.PLEX) && order.includes(MetadataProviderType.JELLYFIN);
    if (!hasBoth) {
      (result as Record<EnrichableField, readonly MetadataProviderType[]>)[field] = order;
      continue;
    }
    const swapped = [...order];
    const primaryIdx = swapped.indexOf(primary);
    const secondaryIdx = swapped.indexOf(secondary);
    [swapped[primaryIdx], swapped[secondaryIdx]] = [swapped[secondaryIdx], swapped[primaryIdx]];
    (result as Record<EnrichableField, readonly MetadataProviderType[]>)[field] = swapped as [
      MetadataProviderType,
      ...MetadataProviderType[],
    ];
  }
  return result;
}
