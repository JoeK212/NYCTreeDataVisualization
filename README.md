# STAND

NYC's Street Trees, Grown From the Census — one branching structure per real tree record.

A single-file Three.js piece that grows a procedural forest from NYC's 2015 Street Tree Census,
fetched live from NYC Open Data. Species, trunk diameter, health, and location all come from the
real record; only the branch shape itself is procedurally grown (seeded per tree, so the same
record always grows the same shape).

Built by Joe.K · [axisbim.io](https://axisbim.io)

## Files

- `index.html` — the whole app. Three.js (r128, via cdnjs), no build step, no dependencies to install.
- `audit_deploy.js` — local pre-ship QA gate, 206 checks as of v1.15.8. Run `node audit_deploy.js`
  before every deploy; it exits 1 on any failure. Committed here (not the usual convention across
  Joe's other tools, which keep this local-only) so a future session — mine or anyone's — has the
  full regression history and can verify a change without rebuilding the checks from scratch.
- `netlify.toml` — publish config, security headers, no-cache on `index.html` so version bumps are
  never served stale.

## Deploy

Same workflow as the rest of the tool suite — GitHub's web UI, no git CLI, flat repo:

1. Create a new GitHub repo (or open the existing STAND one).
2. **Add file → Upload files**, drag in `index.html`, `audit_deploy.js`, `netlify.toml`, this
   `README.md`. Commit directly to `main`.
3. In Netlify: **Add new site → Import an existing project → GitHub**, pick the repo.
4. Build settings: none needed. Publish directory `.` (already set in `netlify.toml`). No build
   command — it's static.
5. Deploy. Netlify auto-redeploys on every push to `main` from here on — future updates are just
   another **Upload files** commit on GitHub.

Before every push: `node audit_deploy.js` locally, confirm it's clean.

## Data sources

- Tree records: [2015 Street Tree Census](https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh), NYC Open Data (SODA API, live-fetched, not bundled)
- Borough boundaries: NYC Open Data
- Context landmasses (NJ / Westchester / Long Island): a nationwide Census county-boundary file — see
  the in-file changelog (top of `index.html`) for the full history of what was tried here, including
  an OSM Overpass attempt at real coastline data that was rolled back in v1.15.8 after two rounds of
  unverifiable-from-sandbox iteration with no visible improvement. Real hydrography (actual water-body
  geometry, not administrative boundaries standing in for coastline) remains the honest next step if
  the Hudson River / Long Island Sound shape is worth revisiting.

## Version

Current: **v1.15.8**. Full changelog lives at the top of `index.html` — every version bump, including
UI-only changes, is logged there with root cause and what was verified.
