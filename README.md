# STAND

NYC's Street Trees, Grown From the Census — one branching structure per real tree record.

A single-file Three.js piece that grows a procedural forest from NYC's Street Tree Census (2005 or
2015), fetched live from NYC Open Data. Species, trunk diameter, health, and location all come from
the real record; only the branch shape itself is procedurally grown (seeded per tree, so the same
record always grows the same shape).

Built by Joe.K · [axisbim.io](https://axisbim.io)

**Live:** https://nycstreettrees.netlify.app/ · **Version:** v1.16.4

## Files

- `index.html` — the whole app. Three.js (r128, via cdnjs), no build step, no dependencies.
- `audit_deploy.js` — pre-ship QA gate (238 checks). Run `node audit_deploy.js` before every push.
- `netlify.toml` — publish config + headers.
- `STAND-EXTENDED.md` — full technical history, architecture notes, and open items. Read this for
  anything not covered here.

## Deploy

GitHub web UI (Add file → Upload files), no git CLI. Netlify auto-redeploys on every push to `main`.
Publish directory `.`, no build command — it's static. Run `node audit_deploy.js` clean before every push.

## Data

Tree records: [2015 Census](https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh) and [2005 Census](https://data.cityofnewyork.us/Environment/2005-Street-Tree-Census/29bw-z7pj), NYC Open Data. Context landmasses (NJ/Westchester/Long Island) via live OSM Overpass query with a Census county-file fallback. Details and full changelog: `STAND-EXTENDED.md` and the changelog block at the top of `index.html`.
