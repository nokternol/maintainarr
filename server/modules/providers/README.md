# Providers module

The providers feature module — the first module converged on the North Star design
(`docs/intent/server-architecture-north-star.md`): it owns everything for the provider domain, from
HTTP transport down to the system job, and exposes it through one crafted public interface.

## Layout

```
providers/
  index.ts                    # Public interface — the only import surface for code outside the module
  providers.schemas.ts        # Zod API contract
  providers.handler.ts        # Route handlers: actuator tasks, ad-hoc metadata, aggregated ratings
  providers.routes.ts         # HTTP wiring
  connections/                # BaseProviderConnection + one class per external system
  roles.ts                    # Capability roles: MediaSource / MediaEnricher / MediaActuator
  mediaSource.ts              # MediaItem / MediaItemSet / MediaSource — the canonical source shapes
  mediaSourceFactory.ts       # ContentType → active owner bound as a MediaSource; sourceOwnership()
  providerFactory.ts          # Constructs the connection class for a stored provider row
  providerSettingsService.ts  # Persistence + projection of configured providers
  taskEnablement.ts           # Per-instance enabledTasks authority (readEnabledTaskIds)
  keyResolver.ts              # API-key resolution priority: request > stored > environment
  plexService.ts              # Validates a Plex auth token against plex.tv (used by auth login)
  tmdbService.ts              # TMDB lookups backed by MediaCache
  identityResolutionJob.ts    # System job linking provider-native ids into media_identity
  identityJobFactory.ts       # Builds the identity job from configured providers
```

## Public interface

Code outside the module imports only from `@server/modules/providers`. The export list in `index.ts`
is a designed contract chosen export by export — never a wholesale re-export — and anything not
exported is module-private. Module-owned tests (`server/__tests__/modules/providers/`) may reach
internals directly; nothing else should.

## Connections

Each external system (Radarr, Sonarr, Tautulli, Jellyfin, Plex, Overseerr, Seerr, TMDB, OMDB,
TVmaze) gets one class in `connections/` extending `BaseProviderConnection`, which supplies a
pre-configured [`ky`](https://github.com/sindresorhus/ky) client (`prefixUrl` from the stored URL +
optional `urlBase` for reverse-proxy installs), a 10-second timeout, JSON `Accept` header, and error
logging hooks. Connection config (URL, API key, settings) lives in the `metadata_providers` table.

The capability roles a connection holds are declared by the role interfaces it `implements` from
`roles.ts` (`MediaSource`, `MediaEnricher`, `MediaActuator`) — never by the base class. See
`docs/architecture/provider-roles-and-identity.md` for the role model.

### Auth patterns

| Provider | Auth method |
|---|---|
| Radarr, Sonarr, Tautulli | `?apikey=` query param |
| Jellyfin | `X-Emby-Authorization` header |
| Overseerr, Seerr | `X-Api-Key` header |
| Plex (metadata) | `X-Plex-Token` header |

### The Plex split

Plex appears twice on purpose:

- **`plexService.ts`** (`PlexService`) — validates a Plex auth token against `plex.tv`; used by
  `AuthService` during login.
- **`connections/plexProvider.ts`** (`PlexProvider`) — fetches libraries and media items from a
  locally configured Plex Media Server, like every other connection.

## Testing

Module tests live in `server/__tests__/modules/providers/`. MSW intercepts outbound `ky`/fetch calls
via `tests/setup/vitest.server.ts`, so URL construction, headers, and response parsing are exercised
against a real HTTP shape. Handlers are declared in `tests/mocks/handlers/`.
