# STAND

NYC's Street Trees, Grown From the Census — one branching structure per real tree record.

A single-file Three.js piece that grows a procedural forest from NYC's 2005 and 2015 Street Tree
Censuses, fetched live from NYC Open Data. Species, trunk diameter, health, and location all come
from the real record; only the branch shape itself is procedurally grown (seeded per tree, so the
same record always grows the same shape).

Built by Joe.K · [axisbim.io](https://axisbim.io)

## Files

- `index.html` — the whole app. Three.js (r128, via cdnjs), no build step, no dependencies to install.
- `audit_deploy.js` — local pre-ship QA gate, 284 checks as of v1.16.18. Run `node audit_deploy.js`
  before every deploy; it exits 1 on any failure. Committed here (not the usual convention across
  Joe's other tools, which keep this local-only) so a future session — mine or anyone's — has the
  full regression history and can verify a change without rebuilding the checks from scratch.
- `netlify.toml` — publish config, security headers, no-cache on `index.html` so version bumps are
  never served stale.

## Deploy

Same workflow as the rest of the tool suite — GitHub's web UI, no git CLI, flat repo:

1. Open this repo.
2. **Add file → Upload files**, drag in the updated `index.html` / `audit_deploy.js` (and this
   `README.md` if it changed too). Commit directly to `main`.
3. Netlify is already connected (**nycstreettrees.netlify.app**) and auto-redeploys on every push to
   `main` — no separate Netlify step needed for routine updates.

Before every push: `node audit_deploy.js` locally, confirm it's clean.

## Data sources

- Tree records: [2015 Street Tree Census](https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh)
  and [2005 Street Tree Census](https://data.cityofnewyork.us/Environment/2005-Street-Tree-Census/29bw-z7pj),
  NYC Open Data (SODA API, live-fetched, not bundled). A third census (1995) exists on the same
  portal but isn't wired up yet — see the in-file changelog (v1.16.0) for why.
- Borough boundaries: NYC Open Data, live-fetched.
- Context landmasses (New Jersey / Westchester / Long Island): real administrative boundaries via
  OSM Overpass, with a Census county-file fallback if that fetch fails. **This was a rocky one** —
  the in-file changelog documents several false starts (v1.15.6–v1.15.8 tried and rolled back OSM
  data blind, with no way to verify from that sandbox at the time; v1.16.4 got it working for real
  once live browser verification became available). Worth reading the changelog directly if picking
  this back up, rather than assuming any single version's summary tells the whole story.
- **Hudson River and Long Island Sound water shapes**: real hydrology data from the USGS National
  Hydrography Dataset (`hydro.nationalmap.gov`), not administrative boundaries standing in for
  coastline — the honest gap flagged in earlier versions of this doc is closed. This took many
  rounds (v1.16.5 through v1.16.18) to get right; the in-file changelog has the full history,
  including a regression along the way (v1.16.11 briefly broke all five boroughs' land fill via a
  function-naming collision, fixed in v1.16.12) and a final resilience fix (v1.16.18) after the
  live USGS API turned out to intermittently fail CORS in ways that varied by browser — both water
  shapes are now baked into the file as a permanent fallback and no longer depend on that fetch
  succeeding even once.
- Everywhere else inside the visible frame that no county data is fetched for (Rockland/Putnam/
  Orange NY, Fairfield CT) is filled with a plain land-colored backdrop (v1.16.16) rather than
  showing as open water — not real boundary data, just enough to avoid an obviously-wrong gap.

## Version

Current: **v1.16.18**. Full changelog lives at the top of `index.html` — every version bump,
including UI-only changes, is logged there with root cause and what was verified. For the water/
coastline work specifically, the changelog entries from v1.16.5 onward are the most useful single
source if you're trying to understand what's real data vs. approximation and why.
