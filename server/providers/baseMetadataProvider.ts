import ky, { type KyInstance } from 'ky';
import type { Logger } from 'winston';

export interface ProviderConfig {
  name: string;
  url: string;
  apiKey: string | null;
  settings: Record<string, unknown> | null;
}

export abstract class BaseMetadataProvider {
  protected provider: ProviderConfig;
  protected log: Logger;
  protected client: KyInstance;

  constructor(provider: ProviderConfig, logger: Logger) {
    this.provider = provider;
    this.log = logger;

    const urlBaseSetting = this.provider.settings?.urlBase;
    const urlBase =
      typeof urlBaseSetting === 'string' ? urlBaseSetting.replace(/^\/+|\/+$/g, '') : '';
    const base = this.provider.url.replace(/\/+$/, '');
    const prefixUrl = urlBase ? `${base}/${urlBase}/` : `${base}/`;

    this.client = ky.create({
      prefixUrl,
      timeout: 10000,
      headers: {
        Accept: 'application/json',
      },
      hooks: {
        beforeError: [
          (error) => {
            this.log.error(`[${this.provider.name}] HTTP Request Failed`, {
              url: error.request.url,
              method: error.request.method,
              errorMessage: error.message,
              responseStatus: error.response?.status,
            });
            return error;
          },
        ],
      },
    });

    this.log.debug(`Initialized ${this.constructor.name} for ${this.provider.name}`, {
      prefixUrl,
    });
  }
}
