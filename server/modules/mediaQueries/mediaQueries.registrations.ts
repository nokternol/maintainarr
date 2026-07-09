import { type AwilixContainer, type NameAndRegistrationPair, asClass } from 'awilix';
import { MediaQueryService } from './mediaQueryService';

/**
 * What the mediaQueries module contributes to the app container. The app
 * builder (`server/container.ts`) extends its `Cradle` from this slice;
 * consumers inject these by cradle name and type against the interface's
 * type exports.
 */
export interface MediaQueriesCradle {
  mediaQueryService: MediaQueryService;
}

/**
 * Register the module's dependencies on the app container. Registration is
 * module-owned so a class needs no value export on the public interface
 * unless consumers construct it directly.
 */
export function registerMediaQueriesDependencies<TCradle extends MediaQueriesCradle>(
  container: AwilixContainer<TCradle>
): void {
  const registrations: NameAndRegistrationPair<MediaQueriesCradle> = {
    mediaQueryService: asClass(MediaQueryService).singleton(),
  };
  // TCradle extends MediaQueriesCradle, so the slice's keys and resolver types
  // are a subset of the app pair type.
  container.register(registrations as NameAndRegistrationPair<TCradle>);
}
