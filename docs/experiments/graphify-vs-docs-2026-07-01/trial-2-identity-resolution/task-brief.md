# Task brief: match Plex items by IMDb id too

Product request (as it would arrive from a PM, not an engineer):

> Our system links a Plex library item to the "canonical" identity record we build for it (the thing
> that lets us join data across Radarr/Sonarr/TMDB/etc. for the same movie or show). Right now that
> linking only works if Plex gives us a TMDB or TheTVDB id for the item. Some items in people's Plex
> libraries only carry an IMDb id (no TMDB/TVDB id at all) — for those, we currently never link them,
> which means they silently miss out on anything downstream that depends on that link.
>
> Please make the linking also work when Plex only gives us an IMDb id, so those items get linked the
> same way the TMDB/TVDB ones already do.

## What we want from you right now

**Do not write or modify any code.** Produce a written implementation plan only:
- Every file you would touch, and why.
- The order you'd make changes in.
- Anything you're not sure about / would need to verify before starting.
- Anything that looks like it could silently break (i.e., no crash, no type error, just wrong behavior)
  if you got it slightly wrong or missed a spot.

Budget yourself as if this were a paid planning engagement — be thorough but don't pad the plan with
padding/boilerplate.
