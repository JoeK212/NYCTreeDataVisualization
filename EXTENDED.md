# STAND — extended technical handoff

Single-file Three.js piece that grows a procedural forest from NYC's Street Tree Census. Species,
trunk diameter, health, and location all come from a real record, fetched live from NYC Open Data;
only the branch shape itself is procedurally grown (seeded per tree, so the same record always
grows the same shape).

- Repo: https://github.com/JoeK212/NYCTreeDataVisualization (public)
- Live: https://nycstreettrees.netlify.app/
- Current version: **v1.16.24**
- Files: `index.html` (the whole app), `audit_deploy.js` (309-check QA gate, committed here for
  continuity), `netlify.toml` (publish config + headers), `README.md` (short overview), this file
  (full technical detail)

The in-file changelog at the top of `index.html` is the real source of truth for every change,
including root cause and what was verified — this document summarizes it, it doesn't replace it.

## Architecture notes

- No build step, no dependencies to install. Three.js r128 via cdnjs.
- Tree data: SODA (Socrata) API against NYC Open Data. `CENSUS_YEARS` config object holds per-year
  dataset id + field mapping (2015: `uvpi-gqnh`; 2005: `29bw-z7pj`). 1995 exists on the same portal
  under multiple different resource IDs across public catalogs with no confirmed-canonical one or
  confirmed lat/lon field — deliberately not wired up rather than guessing.
- Context landmasses (NJ, Westchester, Long Island — decorative backdrop, not tree data): built via
  `buildContextGeometry(features, nameFn)`, which clips to `CONTEXT_CLIP_BOX`, dissolves shared
  edges, and renders fill + outline + label. Two possible feature sources feed it — see below.
- `rebuildForest(records)` is the main render path; deliberately NOT refactored when the growth-
  transition feature was added, because several `audit_deploy.js` checks pattern-match its exact
  structure. `buildForestLayer(records)` is a standalone twin used only by the transition, which
  needs two complete forest layers alive in the scene at once (old fading out, new fading in) —
  something `rebuildForest`'s tear-down-then-rebuild model can't represent.

## The coastline saga (v1.15.3 → v1.16.4)

Long-running thread across several sessions. Summary in order:

1. **v1.15.3** — added Westchester as a third context landmass (was completely missing; the area
   north of the Bronx was bare water/grid).
2. **v1.15.4** — NJ, Westchester, and Long Island were each coming from different/inconsistent
   county-boundary datasets, producing a wedge-shaped gap where the Hudson River should read as
   water. Consolidated onto one shared nationwide Census county file.
3. **v1.15.5** — retired an orphaned `GridHelper` (sized to the pre-v1.14.4 world footprint, never
   widened when the water plane was enlarged — left a visible patchy artifact floating mid-water).
4. **v1.15.6/v1.15.7** — first attempt at real coastline via a live OSM Overpass query (admin
   boundaries are still politically-drawn lines, but OSM's tend to snap to the actual coastline
   rather than being cartographically generalized like Census files). v1.15.7 rescoped the NJ query
   from one whole-state relation to five coastal counties, suspecting a timeout. **Built entirely
   blind** — the sandbox used to build it was network-blocked from `overpass-api.de`, so none of it
   was actually tested against the live endpoint before shipping.
5. **v1.15.8** — after the rescoped v1.15.7 still showed no visible change and no way to get real
   diagnostic feedback, rolled the entire OSM attempt back to v1.15.5 (last version confirmed
   working by direct visual feedback) rather than keep guessing blind.
6. **v1.16.4** — revisited with Claude in Chrome connected, against the real deployed site
   (`nycstreettrees.netlify.app`, running v1.16.3 at the time). This time genuinely verified, not
   blind. Two real bugs found that blind iteration never could have caught:
   - **Name collision across states.** The Overpass query filtered only by `name` + `admin_level`,
     no geographic scope. Live testing turned up three different relations named "Essex County" in
     one response (NJ, NY, and elsewhere) — the query had no way to disambiguate, so it silently
     returned whichever OSM listed first. **Fix:** added a global `[bbox:...]` setting to the query,
     derived from the same `CONTEXT_CLIP_BOX` bounds already used elsewhere in the app. Verified:
     without the bbox, duplicate "Essex County" entries came back; with it, exactly 8 relations, one
     per name, zero collisions.
   - **Intermittent non-JSON responses.** Roughly 2-in-5 live attempts against the public Overpass
     instance returned HTTP 200 with an XML error/rate-limit page instead of the requested JSON —
     `res.ok` is true in this case, so only `JSON.parse` throwing catches it. **Fix:** up to 3
     retries with a short delay before falling back to the county-file path.

   Verification methodology (all done live via Claude in Chrome against the real deployed page,
   using `javascript_tool` to run code directly in the page's own context):
   - Ran the actual Overpass query repeatedly, confirmed the bbox fix eliminates duplicates.
   - Ran the real ring-stitching algorithm (`stitchWaysIntoRings`) against real live data — all 8
     counties resolved to clean, fully-closed rings, zero missing ways/nodes, zero leftover
     fragments. Hudson County correctly produced 3 separate outer rings (real islands/coastline
     complexity, not a stitching failure).
   - Rendered a raw-coordinate overlay (bright magenta `LineLoop`s) directly into the live Three.js
     scene, screenshotted, and visually confirmed the OSM boundary traces an actual narrow river
     channel along the Hudson — distinctly different from the old county-file fill's wide wedge.
   - Ran the real `buildContextGeometry` pipeline against the live OSM data (the actual function the
     app uses, not a mock), screenshotted the real rendered fill, and confirmed it hugs the real
     riverbank.
   - All three context loaders (NJ, Westchester, Long Island) still fall back to the v1.15.4
     county-file path on any failure — this safety net is not optional polish; the observed ~40%
     Overpass flakiness makes it load-bearing.

   This was verified by injecting code into the live *v1.16.3* deployment before v1.16.4 itself was
   pushed — since confirmed live and deployed many versions ago; see the v1.16.19–v1.16.24 summary
   below for the most recent work in this same area.

## Other recent feature work

- **v1.16.0** — multi-year census support. A Census year control switches the whole sample between
  2005 and 2015 (same borough/filter selections). 2005's schema differs slightly (no `tree_id` —
  `objectid` substitutes; no separate alive/dead flag — its `status` column carries the health value
  directly, mapped straight to `health`).
- **v1.16.1/v1.16.2** — animated "Watch it grow" transition between census years (a crossfade, not a
  per-tree growth simulation — NYC's censuses don't share a consistent tree ID across years, so
  there's no way to know which 2015 tree, if any, corresponds to a given 2005 one; stated explicitly
  in the in-app help modal). Duration tuned from 3.2s to 6.5s after direct feedback it was too fast
  to read. Animates opacity + canopy point *size*, deliberately not scale/position (scaling a
  Points/Mesh object scales around its own local origin; since these meshes bake real world-space
  coordinates into their vertex buffers, a scale transform would drag every tree toward world (0,0,0)
  instead of growing in place).
- **v1.16.3** — button UI modernization after direct feedback it looked dated ("Windows 95"). Root
  cause wasn't the sharp corners (zero border-radius is deliberate brand language across Joe's whole
  tool suite) — it was a total absence of `:hover`/`transition` CSS. Added those, plus converted the
  five toggle-group rows (Borough, Census year, Canopy color, Trunk size, View) to a segmented-
  control treatment (shared outer border, divider between buttons instead of gaps). Standalone
  one-shot action buttons (Reseed, Recenter, Watch it grow) deliberately kept as separate pills, not
  folded into segments.

## Working conventions

- Deploy via GitHub's web UI (Add file → Upload files), not git CLI — matches Joe's workflow across
  his whole tool suite. Flat repo, no branches.
- `netlify.toml`: `publish = "."`, security headers, `Cache-Control: no-cache` on `index.html` so
  version bumps are never served stale.
- Every change, including UI-only ones, gets a version bump and a changelog entry at the top of
  `index.html` — root cause, what broke, what was verified. This has been essential for continuity
  across sessions and should keep being followed.
- `audit_deploy.js`: run before every push, must exit clean. When a fix legitimately supersedes an
  earlier check's assumption, update that check to assert the new behavior rather than deleting the
  historical record — see how the OSM rollback-then-restoration checks were handled as a pattern.
- Claude in Chrome is connected. Use it for anything visual or live-data-dependent — don't guess
  blind at network behavior or rendered output when a real browser is available to check.

## v1.16.19 – v1.16.24 — NJ/Westchester coverage saga, water color, and a real perf fix

Another long-running thread, summarized here — full root-cause detail is in `index.html`'s changelog:

1. **v1.16.19** — `loadOsmContext()` had retries but no client-side timeout; a hung Overpass request
   could leave the app looking fully broken for 1.5–3+ minutes before the fallback ever ran. Fixed
   with `fetchWithTimeout` (AbortController, 15s/attempt) on every live geo fetch.
2. **v1.16.20** — a real NJ land-coverage gap in the NW corner, initially (wrongly) suspected as a
   GitHub→Netlify deploy-pipeline issue. Ruled that out by diffing GitHub source, Netlify-served
   bytes, and the local file byte-for-byte (identical). Actual cause: `NJ_OSM_COUNTIES` and the
   Overpass query itself both only listed 5 counties, a leftover from before the frame was widened —
   6 counties that genuinely intersect `CONTEXT_CLIP_BOX` (Mercer, Middlesex, Monmouth, Morris,
   Somerset, Sussex) were never requested. Added all 6.
3. **v1.16.21** — the v1.16.20 fix didn't actually reach the site. Querying the real Overpass endpoint
   directly showed it deterministically returned only the original 8 relations, dropping all 6 new
   ones — not the known ~40% intermittent-failure flakiness (this returned valid JSON, just
   incomplete). Isolated live: Overpass silently drops relation clauses inserted mid-union; the same
   clauses appended at the end of the union return correctly. Reordered accordingly.
4. **v1.16.22** — the v1.16.21 fix was verified correct against the live Overpass endpoint, but the
   same gap was still visible. Cause: `loadOsmContext()` reads `localStorage` before ever fetching,
   with no expiry logic — a stale `stand_osm_context_v2` cache entry (8 counties, from before the
   fix) meant the corrected query never ran. Bumped the cache key to `v3`. **Any future change to
   what `buildOsmAdminQuery`/`NJ_OSM_COUNTIES` return must bump this cache key in the same edit**, or
   it will silently fail to reach returning visitors even though the deployed code is correct.
5. **v1.16.23** — two marked-up screenshots showed visibly different water blues plus a double
   outline. The base ocean plane renders a radial gradient texture; the Hudson/Sound water overlays
   were filled with a flat guessed color (`0x122A3B`) instead. Verified live via `gl.readPixels`
   (harbor water: `rgb(27,62,81)` vs. the flat overlay: `rgb(18,42,59)` right next to it — a real,
   confirmed seam). Fixed by sharing the base plane's exact texture with correctly computed
   world-space UVs (`WATER_PLANE_SIZE`, `getWaterTexture()`).
6. **v1.16.24** — performance. Switching Canopy Color mode called full `rebuildForest`, re-running
   `growTree`'s entire recursive branch walk for every tree just to change a color — timed live at
   4.1–5.4s of complete main-thread freeze at the default 7,000-tree sample. `growTree` is
   deterministically seeded per tree, so branch geometry never actually changes with color mode; only
   canopy-point colors do. Added `updateForestColors()`, which rewrites just the color attributes in
   place, with a per-`tree_id` cache since a tree's several leaf points all share one color. Cut the
   live-measured time to 120ms (~35–45x faster), confirmed byte-identical output against a full
   rebuild before wiring the color/season buttons to it.

## Known open items

- 1995 census not wired up (schema/canonical-resource-ID unconfirmed).
- Real hydrography for the water shapes is done (v1.16.11/v1.16.18 — see above); the coastline/admin
  boundaries elsewhere in the frame are still cartographically-generalized county/state lines, not
  hydrology-precise, and that's an accepted tradeoff for a stylized backdrop layer, not a bug.
- Minor map-graphics cleanup items flagged by Joe as lower priority, not yet itemized here — pick up
  from the live conversation history / project memory if resuming this thread.
