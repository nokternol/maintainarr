# Providers

External media-service integrations. Each provider connects to a running third-party service (Radarr, Sonarr, Tautulli, etc.) to fetch metadata.

## Architecture

All providers extend `BaseMetadataProvider`, which supplies:
- A pre-configured [`ky`](https://github.com/sindresorhus/ky) client pointing at the stored `MetadataProvider.url`
- Optional `urlBase` path prefix support (e.g. `/radarr` for reverse-proxy installs)
- 10-second timeout and JSON `Accept` header
- Error logging hooks with request context

Connection configuration (URL, API key, settings) is stored in the `MetadataProvider` database entity.

## vs. `services/`

| | `services/` | `providers/` |
|---|---|---|
| **Base** | No special base class | `BaseMetadataProvider` |
| **Dependencies** | TypeORM DataSource, other services | `MetadataProvider` entity + Logger |
| **Role** | Internal business logic, orchestration | Fetch data from external APIs |
| **Auth** | Session / token validation | API key passed per-request |
| **Examples** | `AuthService`, `PlexService`, `TmdbService` | `RadarrProvider`, `JellyfinProvider` |

## Auth Patterns

| Provider | Auth method |
|---|---|
| Radarr, Sonarr, Tautulli | `?apikey=` query param |
| Jellyfin | `X-Emby-Authorization` header |
| Overseerr, Seerr | `X-Api-Key` header |
| Plex (metadata) | `X-Plex-Token` header |

## Plex Split

Plex spans both directories deliberately:
- **`services/plexService.ts`** (`PlexService`) — validates a Plex auth token against `plex.tv`. Used by `AuthService` during login.
- **`providers/plexProvider.ts`** (`PlexProvider`) — fetches libraries and media items from a locally configured Plex Media Server. Uses `BaseMetadataProvider` like the rest.

## Testing

Provider tests live in `server/__tests__/providers/`. MSW intercepts outbound `ky`/fetch calls via `tests/setup/vitest.server.ts`. Handlers are in `tests/mocks/handlers/`.
