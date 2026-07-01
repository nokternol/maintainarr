# Task brief: multi-select filter rules

Product request (as it would arrive from a PM, not an engineer):

> Some of our media filter rules let you pick from a fixed set of values — for example genre or
> network. Right now those render as a plain comma-separated text box, which is bad UX (users have to
> know the exact spelling of every genre and type it by hand). We want these rules to render as a proper
> multi-select checkbox/tag picker instead, where the user picks from a known list of options.
>
> Please add support for a new kind of filter rule — call it `multi-select` — that:
> - Is declared once per rule (like our other rule types) with its own fixed option list.
> - Renders as a multi-select picker in the UI instead of free text.
> - Behaves correctly when filters are applied, saved, reloaded from a saved query, and deep-linked via
>   URL — a user should be able to bookmark a URL with a multi-select filter applied and get the same
>   result back.
>
> We'd like one rule (your choice, whichever is easiest) converted to use this as a proof of concept.

## What we want from you right now

**Do not write or modify any code.** Produce a written implementation plan only:
- Every file you would touch, and why.
- The order you'd make changes in.
- Anything you're not sure about / would need to verify before starting.
- Anything that looks like it could silently break (i.e., no crash, no type error, just wrong behavior)
  if you got it slightly wrong or missed a spot.

Budget yourself as if this were a paid planning engagement — be thorough but don't pad the plan with
padding/boilerplate.
