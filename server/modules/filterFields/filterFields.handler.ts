import type { NextFunction, Request, Response } from 'express';
import { MEDIA_RULES, toDescriptor } from '../../utils/filterRegistry';
import type { ContentType, MediaRuleDescriptor } from '../../utils/filterRegistry';
import type { ProviderSettingsService } from '../providers';

interface FilterFieldsCradle {
  providerSettingsService: ProviderSettingsService;
}

export function createFilterFieldsHandlers(cradle: FilterFieldsCradle) {
  const { providerSettingsService } = cradle;

  async function gatedDescriptors(contentType?: ContentType): Promise<MediaRuleDescriptor[]> {
    const configuredTypes = await providerSettingsService.activeTypes();

    return MEDIA_RULES.filter(
      (rule) => contentType === undefined || rule.contentTypes.includes(contentType)
    )
      .filter((rule) => rule.sourceProviders.some((sp) => configuredTypes.has(sp)))
      .map(toDescriptor);
  }

  return {
    async getFilterFields(req: Request, res: Response, next: NextFunction): Promise<void> {
      const { contentType } = req.query;

      if (contentType !== undefined && contentType !== 'movie' && contentType !== 'show') {
        res.status(400).json({ error: `Invalid contentType: must be 'movie' or 'show'` });
        return;
      }

      try {
        res.json(await gatedDescriptors(contentType as ContentType | undefined));
      } catch (err) {
        next(err);
      }
    },
  };
}
