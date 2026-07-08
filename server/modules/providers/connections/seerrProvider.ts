import { OverseerrProvider } from './overseerrProvider';

// Seerr is a fork of Overseerr with an identical API.
// Re-export OverseerrProvider under a distinct name so the DI container
// can register it as a separate SEERR-typed provider.
export { OverseerrProvider as SeerrProvider };
