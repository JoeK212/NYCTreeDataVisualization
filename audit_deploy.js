#!/usr/bin/env node
/**
 * STAND — deploy audit
 * Joe.K · axisbim.io
 *
 * Local-only pre-ship check for index.html. Run before every deploy.
 * Exits 1 on any failure so it can gate a deploy script if desired.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
const src = fs.readFileSync(FILE, 'utf8');

const RESET='\x1b[0m', GREEN='\x1b[32m', RED='\x1b[31m', DIM='\x1b[2m', BOLD='\x1b[1m';
let pass = 0, fail = 0;
const failures = [];

function sectionHeader(name){ console.log(`\n${BOLD}${name}${RESET}`); }
function check(desc, cond){
  if(cond){ pass++; console.log(`  ${GREEN}✓${RESET} ${desc}`); }
  else{ fail++; failures.push(desc); console.log(`  ${RED}✗${RESET} ${desc}`); }
}

/* ===================== Version sync ===================== */
sectionHeader('Version sync');
const changelogTop = src.match(/CHANGELOG\s*\n\s*v([\d.]+)/);
const appVersionMatch = src.match(/const APP_VERSION = '([\d.]+)'/);
check('APP_VERSION constant is present', !!appVersionMatch);
check('top changelog entry is present', !!changelogTop);
check('APP_VERSION matches the top changelog entry',
  !!(changelogTop && appVersionMatch && changelogTop[1] === appVersionMatch[1]));

/* ===================== Debug / leftover artifacts ===================== */
sectionHeader('Debug / leftover artifacts');
check('no console.log left in source', !/console\.log\(/.test(src));
check('no debugger statements', !/\bdebugger\b/.test(src));
check('no lorem ipsum placeholder text', !/lorem ipsum/i.test(src));
check('no leftover alert( calls (use toast() instead)', !/\balert\(/.test(src));
check('no native confirm( calls (use confirmDialog() instead)', !/[^\w]confirm\(/.test(src));

/* ===================== Mobile / PWA conventions ===================== */
sectionHeader('Mobile / PWA conventions');
check('viewport-fit=cover present', /viewport-fit=cover/.test(src));
check('apple-mobile-web-app-capable present', /apple-mobile-web-app-capable/.test(src));
check('mobile-web-app-capable present (Chrome)', /name="mobile-web-app-capable"/.test(src));
check('overscroll-behavior-y: contain set on body', /overscroll-behavior-y\s*:\s*contain/.test(src));

/* ===================== STAND-specific invariants ===================== */
sectionHeader('v1.0.0 — data + rendering invariants');
check('SODA API base URL points at the 2015 Street Tree Census dataset (uvpi-gqnh)',
  /uvpi-gqnh/.test(src));
check('fetchSample() filters to status=Alive with non-null lat/long', /status='Alive'/.test(src));
check('mulberry32 seeded PRNG present (reproducible per-tree geometry)', /function mulberry32/.test(src));
check('tree geometry seeded from tree_id, not Math.random() at grow-time',
  /hashString\(String\(rec\.tree_id/.test(src));
check('offline synthetic fallback exists for blocked/failed fetch', /function syntheticSample/.test(src));
check('forest branches batched into a single indexed Mesh draw call (real geometry, not GL_LINES)',
  /new THREE\.Mesh\(branchGeo, branchMat\)/.test(src));
check('canopy batched into a single Points draw call', /new THREE\.Points\(ptGeo/.test(src));
check('old geometry disposed before rebuild (no leak on borough switch / reseed)',
  /forestLines\.geometry\.dispose\(\)/.test(src) && /forestPoints\.geometry\.dispose\(\)/.test(src));
check('custom orbit controls implemented (three@r128 cdnjs has no OrbitControls addon)',
  /function attachOrbitControls/.test(src));
check('THREE.CapsuleGeometry not used (unavailable pre-r142)', !/CapsuleGeometry/.test(src));
check('toast() helper present for all user-facing status messages', /function toast\(/.test(src));

sectionHeader('v1.1.0 — geographic context invariants');
check('borough boundary dataset URL points at gthc-hcne', /gthc-hcne/.test(src));
check('boundary fetch has a synthetic rectangle fallback (no boundary fetch = no crash)',
  /buildBoundaryGeometry\(null\)/.test(src));
check('shared BOROUGH_BOUNDS_APPROX used by both tree fallback and boundary fallback (no duplicated bounds)',
  (src.match(/BOROUGH_BOUNDS_APPROX/g) || []).length >= 3);
check('scale bar distance derived from the lat/long projection, not a hardcoded guess',
  /MILES_PER_UNIT = \(\(LON_MAX - LON_MIN\)/.test(src));
check('old boundary geometry disposed before rebuild', /boundaryGroup\.children\.forEach\(c=>\{ c\.geometry\.dispose/.test(src));
check('labels repositioned every animate() frame via updateLabels()', /updateLabels\(\);\s*\n\}/.test(src));

sectionHeader('v1.2.0 — NYC readability invariants');
check('"All" view fetches each borough separately (fetchAllBoroughsEvenly), not one offset window',
  /async function fetchAllBoroughsEvenly/.test(src));
check('loadAndRender routes borough===\'All\' through fetchAllBoroughsEvenly', /fetchAllBoroughsEvenly\(\)/.test(src));
check('filled landmass mesh built via THREE.Shape/ShapeGeometry (hole-aware)', /new THREE\.ShapeGeometry\(shape\)/.test(src));
check('landmass fill uses depthWrite:false so it never occludes trees above it', /depthWrite:\s*false/.test(src));
check('default camera is top-down / north-up, not the old oblique framing',
  /'3d':\s*\{camDist: 1040, camTheta: Math\.PI\/2, camPhi: 0\.55\}/.test(src));

sectionHeader('v1.3.0 — boundary fetch correctness');
check('boundary fetch uses the plain .json SODA endpoint, not .geojson (which was failing silently)',
  /gthc-hcne\.json/.test(src) && !/gthc-hcne\.geojson/.test(src));
check('boundary rows are validated as an array before use', /Array\.isArray\(rows\)/.test(src));

sectionHeader('v1.4.0 — defensive parsing + density/scale');
check('no server-side $select/simplify() on the boundary query (removed as a silent-failure source)',
  !/gthc-hcne\.json\?\$select/.test(src));
check('borough name/geometry are discovered by scanning row keys, not hardcoded field names',
  /function extractBoroughFeature/.test(src));
check('point count reduced client-side (decimateRing/decimateGeometry), not via a server function',
  /function decimateRing/.test(src) && /function decimateGeometry/.test(src));
check('failed boundary fetch surfaces the actual response body, not just a status code',
  /res\.text\(\)\.catch/.test(src));
check('"All" per-borough sample above the original v1.0 baseline of 900 (density work from v1.4, since revised down in v1.9 to offset heavier mesh geometry)',
  /SAMPLE_LIMIT_PER_BOROUGH = 1400/.test(src));
check('single-borough sample above the original v1.0 baseline of 3200 (same note)', /SAMPLE_LIMIT_SINGLE = 4200/.test(src));
check('default camera distance tightened so the city fills the frame', /camDist: 1040/.test(src));

sectionHeader('v1.5.0 — view controls');
check('recenterView() resets both camera preset and pan target', /function recenterView/.test(src));
check('Plan and 3D view presets both defined', /VIEW_PRESETS = \{/.test(src) && /'plan':/.test(src));
check('multi-pointer tracking (Map) supports simultaneous orbit vs pan/pinch', /const pointers = new Map\(\)/.test(src));
check('pan uses camera screen-space basis, not raw world axes (consistent across orbit angles)',
  /camera\.matrixWorld\.extractBasis/.test(src));
check('right-click context menu suppressed so right-drag can be used for pan', /contextmenu.*preventDefault/.test(src));
check('orbit phi clamp allows a true near-top-down angle (min <= 0.05)', /Math\.max\(0\.04,/.test(src));
check('Recenter button wired to recenterView()', /recenterBtn.*addEventListener.*recenterView/.test(src));

sectionHeader('v1.6.0 — data-driven legend');
check('health legend computes real counts from currentRecords, not a static list', /counts\[counts\.hasOwnProperty\(r\.health\)/.test(src));
check('species legend swatch color comes from the same speciesColor() used for rendering (no drift)',
  /const c = speciesColor\(species\)/.test(src));
check('species legend rolls remainder into an "N more species" entry rather than truncating silently',
  /more species/.test(src));
check('renderLegend() runs at the end of rebuildForest() so it refreshes on every data change',
  /renderLegend\(\);\s*\n\}/.test(src));
check('legend handles the empty-sample state before first load', /Legend fills in once a sample is loaded/.test(src));

sectionHeader('v1.7.0 — compass dial + help + tooltips');
check('world-anchored north label removed (northWorldPos/northEl no longer exist)',
  !/northWorldPos/.test(src) && !/northEl/.test(src));
check('fixed compass dial present and driven by camTheta only (azimuth, not pitch)',
  /function updateCompass/.test(src) && /camTheta - Math\.PI\/2/.test(src));
check('compass dial click resets orientation without touching zoom/pan', /camTheta = Math\.PI \/ 2;\s*\n\s*updateCamera\(\);/.test(src));
check('help modal exists with open/close wiring', /function openHelp/.test(src) && /function closeHelp/.test(src));
check('help modal closes on Escape key', /e\.key === 'Escape'/.test(src));
check('borough/color-mode/view-mode buttons render with title tooltips', /title="\$\{escapeAttr\(title\)\}"/.test(src) || /title="\$\{b===/.test(src));

sectionHeader('v1.8.0 — extended bounds, water, NJ context');
check('map bounds extended north/west (LAT_MAX >= 41.0, LON_MIN <= -74.4)',
  /LAT_MAX=41\.20/.test(src) && /LON_MIN=-74\.45/.test(src));
check('WORLD_SIZE scaled up to match the wider bounds (not left at the old 900)', /const WORLD_SIZE = 1200/.test(src));
check('camera presets scaled to match the larger WORLD_SIZE', /camDist: 1040/.test(src) && /camDist: 1270/.test(src));
check('water base plane exists with a canvas gradient texture, not a flat color', /function makeWaterTexture/.test(src) && /createRadialGradient/.test(src));
check('land fill opacity raised so land reads as solid against the water (>= 0.9; raised again to fully opaque 1.0 in v1.12.0 — see below)', /opacity: 1\.0/.test(src));
check('explicit renderOrder assigned across water/land/outline/tree layers (4 distinct values; grid retired in v1.15.5 — see below)',
  (src.match(/renderOrder = \d/g) || []).length + (src.match(/\.renderOrder = 0;/g)||[]).length >= 4);
check('New Jersey context loader is separate from the NYC borough pipeline and fails silently (no toast on error)',
  /async function loadStateContext/.test(src) && !/loadStateContext[\s\S]{0,400}toast\(/.test(src));
check('NJ outline no longer uses LineDashedMaterial (dashed context outline removed/superseded in v1.12.2 — see below)', !/LineDashedMaterial/.test(src));
check('context labels (e.g. New Jersey) styled distinctly fainter than primary borough labels',
  /context-label/.test(src));

sectionHeader('v1.9.0 — legend/color consistency, real branch geometry, click-to-inspect');
check('top-species set computed once per rebuild and shared between rendering and legend',
  /function topSpeciesSet/.test(src) && /function speciesTally/.test(src));
check('non-top species render in a fixed OTHER_SPECIES_COLOR, not their own hash hue',
  /canopyColor = isTop \? speciesColor\(rec\.species\) : OTHER_SPECIES_COLOR/.test(src));
check('legend "more species" swatch uses the exact same OTHER_SPECIES_HEX constant (guaranteed match)',
  /background:\$\{OTHER_SPECIES_HEX\}/.test(src));
check('branch geometry is real tapered mesh (emitBranchSegment), not GL_LINES', /function emitBranchSegment/.test(src));
check('branch radius scales with trunk diameter and tapers by generation', /function branchRadius\(gen\)/.test(src));
check('branch geometry uses Uint32 indices (vertex count can exceed 65535 at full sample size)',
  /new THREE\.Uint32BufferAttribute\(out\.branchIdx/.test(src));
check('sample sizes reduced to offset heavier mesh geometry cost', /SAMPLE_LIMIT_SINGLE = 4200/.test(src) && /SAMPLE_LIMIT_PER_BOROUGH = 1400/.test(src));
check('each canopy point tracks its source record for click-to-inspect (pointRecordRef)',
  /out\.pointRecordRef\.push\(rec\)/.test(src));
check('click-to-inspect raycasts against canopy points, not the branch mesh', /raycaster\.intersectObject\(forestPoints\)/.test(src));
check('tap-vs-drag distinguished by movement distance, so orbiting doesn\'t trigger a lookup',
  /Math\.hypot\(e\.clientX - downX, e\.clientY - downY\) > 6/.test(src));
check('tree info card cleared on rebuild (pointRecordRefs about to change under it)', /function rebuildForest\(records\)\{\s*\n\s*hideTreeInfo\(\)/.test(src));

sectionHeader('v1.10.0 — Manhattan fetch fix, visual density, context visibility');
check('per-borough offset capped to a range safe for the smallest borough (Manhattan)', /const SAFE_MAX_OFFSET = 30000/.test(src));
check('fetchSampleSafe retries at offset 0 if a borough returns empty', /async function fetchSampleSafe/.test(src) && /if\(!rows\.length\) rows = await fetchSample\(year, borough, 0/.test(src));
check('both All-boroughs and single-borough fetches use the safe offset path', (src.match(/fetchSampleSafe\(/g) || []).length >= 3);
check('branch radius thinned from the v1.9 values (baseRadius formula changed)', /const baseRadius = 0\.16 \+ dbh \* 0\.022/.test(src));
check('branch mesh opacity softened to reduce overlap blob-density at full-city zoom', /opacity:0\.68/.test(src));
check('canopy points use a soft round dot sprite instead of flat hard-edged squares', /function makeDotTexture/.test(src) && /map:getDotTexture\(\)/.test(src));
check('dot texture cached rather than regenerated on every forest rebuild', /function getDotTexture/.test(src) && /dotTextureCache/.test(src));
check('context boundary builder generalized and shared between NJ and Long Island', /function buildContextGeometry/.test(src));
check('context land gets a subtle fill (not just a thin dashed line) so it reads as land at a glance',
  /const contextFillMat = new THREE\.MeshBasicMaterial/.test(src));
check('Long Island (Nassau/Suffolk) context loader present, separate and non-critical', /async function loadLongIslandContext/.test(src));
check('contextLabels accumulated via push across loaders, not overwritten (race condition fix)',
  /contextLabels\.push\(\.\.\.Object\.entries/.test(src) && !/contextLabels = Object\.entries/.test(src));

sectionHeader('v1.11.0 — context geometry clipping, zoom-based branch visibility');
check('context geometry is clipped to a local box before rendering (Sutherland-Hodgman)', /function clipRingToBox/.test(src) && /function clipGeometryToBox/.test(src));
check('CONTEXT_CLIP_BOX defined relative to the map bounds, not hardcoded absolute coordinates',
  /const CONTEXT_CLIP_BOX = \{ lonMin: LON_MIN/.test(src));
check('buildContextGeometry clips before both the outline and fill passes (single source of truth — v1.13.3 split this into clippedRaw for fill and a mainRingOf-reduced clipped for outline/centroid, both still sourced from one clipGeometryToBox pass)',
  /const clippedRaw = features\s*\n\s*\.map\(f => \(\{ name: nameFn\(f\), geom: clipGeometryToBox/.test(src));
check('branch mesh visibility toggled by zoom distance, not just tuned thickness/opacity', /function updateBranchVisibility/.test(src));
check('branch visibility synced on every camera update (orbit/pan/zoom/recenter/preset all call updateCamera)',
  /updateBranchVisibility\(\);\s*\n\s*updateFog\(\);\s*\n\}/.test(src));
check('branch visibility synced immediately after a fresh forest rebuild (new mesh defaults to visible=true)',
  /scene\.add\(forestLines\);\s*\n\s*updateBranchVisibility\(\);/.test(src));

sectionHeader('v1.12.0 — context clip-box/opacity fix, RDP coastline simplification');
check('CONTEXT_CLIP_BOX margins are sized in world-space terms, not blindly copied from a fixed degree offset (regression check against the v1.11.0 bug: NJ landed almost entirely off-canvas)',
  /lonMin: LON_MIN - 0\.25/.test(src) && /lonMax: LON_MAX \+ 0\.45/.test(src));
check('context fill opacity raised well past the old washed-out 0.38 (>= 0.9; raised again to fully opaque 1.0 in v1.13.0 — see below)',
  /opacity: 0\.9[0-9]/.test(src) || /color: 0x4A4230, transparent: true, opacity: 1\.0/.test(src));
check('primary NYC land fill is fully opaque (no water can show through it)', /color: 0x3A3323, transparent: true, opacity: 1\.0/.test(src));
check('borough-boundary decimation uses Ramer–Douglas–Peucker (tolerance-based), not uniform every-Nth-point sampling',
  /function rdpSimplify/.test(src) && /function pointToSegmentDist/.test(src));
check('RDP simplification is iterative (explicit stack), not recursive — real coastline rings can have thousands of points',
  /const stack = \[\[0, n-1\]\]/.test(src));
check('decimateGeometry call site passes the tolerance constant, not a leftover keepEvery integer',
  /decimateGeometry\(f\.geometry, SIMPLIFY_TOLERANCE_DEG\)/.test(src));

sectionHeader('v1.12.1 — NJ context switched to county-level resolution');
check('NJ fill comes from a county-level dataset, not a single ~32-point statewide polygon (the resolution bug: no Bayonne peninsula/Kill Van Kull/accurate Hudson shoreline at state-polygon detail)',
  /const NJ_COUNTIES_URL = 'https:\/\/raw\.githubusercontent\.com\/plotly\/datasets\/master\/geojson-counties-fips\.json'/.test(src));
check('NJ counties filtered by FIPS state code, not by name string matching', /f\.properties\.STATE === NJ_STATE_FIPS/.test(src));
check('large nationwide county source is cached in localStorage after first successful fetch (avoid re-downloading ~3.2MB every load)',
  /NJ_CONTEXT_CACHE_KEY/.test(src) && /localStorage\.setItem\(NJ_CONTEXT_CACHE_KEY/.test(src) && /localStorage\.getItem\(NJ_CONTEXT_CACHE_KEY\)/.test(src));
check('localStorage cache write is defensively wrapped (quota/unavailable storage must not break the load)',
  /try\{ localStorage\.setItem\(NJ_CONTEXT_CACHE_KEY[\s\S]{0,80}\n\s*catch\(e\)/.test(src));
check('no leftover fillOnly/outlineOnly split in code (v1.12.1\'s two-source approach was itself superseded by v1.12.2\'s single-source dissolve — the changelog above still narrates it by name, which is expected)',
  !/\{\s*fillOnly/.test(src) && !/opts\.fillOnly/.test(src) && !/fillOnly:\s*true/.test(src) && !/NJ_STATE_OUTLINE_URL\s*=/.test(src));

sectionHeader('v1.12.2 — outline traced from the fill itself, dissolved + de-artifacted');
check('context outline is solid (LineBasicMaterial), matching NYC\'s own borough outline treatment, not a separately-sourced dashed line',
  /const mat = new THREE\.LineBasicMaterial\(\{color:0xD6C9A9, transparent:true, opacity:0\.6, depthWrite:false, fog:false\}\);\s*\n\s*const lines = new THREE\.LineSegments\(geo, mat\);\s*\n\s*lines\.renderOrder = 3;/.test(src));
check('outline is built via edge-dissolve (segments appearing exactly once), not by drawing every ring including internal county seams',
  /function outerBoundarySegments/.test(src) && /function segKey/.test(src));
check('dissolve canonicalizes segment endpoints order-independently (same edge must cancel regardless of which polygon or winding direction contributed it)',
  /const \[p, q\] = \(ra\[0\] < rb\[0\] \|\| \(ra\[0\] === rb\[0\] && ra\[1\] < rb\[1\]\)\) \? \[ra, rb\] : \[rb, ra\];/.test(src));
check('largestConnectedComponent present and applied to the dissolved outline (drops small stray loops)',
  /function largestConnectedComponent/.test(src) && /largestConnectedComponent\(outerSegsRaw\)/.test(src));
check('ring self-touch splitting present and applied before fill/outline see the geometry (bowtie clip-artifact fix — a loop can be graph-connected to the mainland at one pinch point yet still read as visually floating)',
  /function splitSelfTouchingRing/.test(src) && /function mainRingOf/.test(src));
check('mainRingOf keeps the largest-area piece after a self-touch split, not just the first piece encountered',
  /pieces\.reduce\(\(a, b\) => ringArea\(b\) > ringArea\(a\) \? b : a\)/.test(src));
check('ring cleanup (mainRingOf) runs immediately after clipping, before outline/centroid consume the geometry (v1.13.3: fill now deliberately uses the pre-reduction clippedRaw instead, for full coverage — see below)',
  /const clipped = clippedRaw\s*\n\s*\.map\(\(\{name, geom\}\) => \{/.test(src));

sectionHeader('v1.13.0 → v1.13.1 — seamless context fill via buffered per-feature meshes, opaque again');
check('the fragile single-ring dissolve walk (orderSegmentsIntoRing) is not present as live code (removed in v1.13.1 — real county topology has branch points a simple walk can\'t handle)',
  !/function orderSegmentsIntoRing/.test(src));
check('bufferedPolygonFillMesh exists and pushes ring vertices outward from their own centroid by a fixed epsilon before triangulating',
  /function bufferedPolygonFillMesh\(ringSet, material, eps, exteriorKeySet\)/.test(src) && /const dx = p\.x - cx, dz = p\.z - cz, len = Math\.hypot\(dx, dz\) \|\| 1;/.test(src));
check('fill is built with the buffered variant, one mesh per real split piece (v1.13.3 superseded the plain one-mesh-per-feature call sites checked here originally — see the v1.13.3 section below for the current call sites)',
  /function bufferedPolygonFillMesh\(ringSet, material, eps, exteriorKeySet\)/.test(src) && /bufferedPolygonFillMesh\(\[piece, \.\.\.geom\.coordinates\.slice\(1\)\], contextFillMat, FILL_BUFFER_EPS, exteriorSegKeySet\)/.test(src) && /bufferedPolygonFillMesh\(\[piece, \.\.\.ringSet\.slice\(1\)\], contextFillMat, FILL_BUFFER_EPS, exteriorSegKeySet\)/.test(src));
check('outline still reuses the same dissolved outerSegs (unordered use is unaffected by the fill\'s topology bug, so it was left alone)',
  /const outerSegsRaw = outerBoundarySegments\(allRings\);\s*\n\s*const outerSegs = largestConnectedComponent\(outerSegsRaw\);/.test(src) && (src.match(/largestConnectedComponent\(outerSegsRaw\)/g) || []).length === 1);
check('contextFillMat opacity is fully opaque (>= 1.0), matching NYC\'s own land fill treatment',
  /color: 0x4A4230, transparent: true, opacity: 1\.0/.test(src));

sectionHeader('v1.13.2 — grid/outline depthWrite z-fighting fix');
check('grid retired entirely in v1.15.5 (see below) — no GridHelper left to depthWrite-fix', !/new THREE\.GridHelper/.test(src));
check('context outline LineBasicMaterial also sets depthWrite:false (same missing-flag bug fixed proactively)',
  /const mat = new THREE\.LineBasicMaterial\(\{color:0xD6C9A9, transparent:true, opacity:0\.6, depthWrite:false, fog:false\}\);/.test(src));
check('NYC borough outline LineBasicMaterial also sets depthWrite:false (same missing-flag bug fixed proactively)',
  /const lineMat = new THREE\.LineBasicMaterial\(\{color:0xD6C9A9, transparent:true, opacity:0\.6, depthWrite:false, fog:false\}\);/.test(src));

sectionHeader('v1.13.3 — fill covers every split piece, not just the largest');
check('clippedRaw (clipped but not yet mainRingOf-reduced) is kept alongside the reduced clipped list',
  /const clippedRaw = features\s*\n\s*\.map\(f => \(\{ name: nameFn\(f\), geom: clipGeometryToBox\(f\.geometry, CONTEXT_CLIP_BOX\) \}\)\)/.test(src) &&
  /const clipped = clippedRaw\s*\n\s*\.map\(\(\{name, geom\}\) => \{/.test(src));
check('fillPiecesOf keeps every self-touch-split piece above a tiny noise-floor area, not just the largest',
  /function fillPiecesOf\(ring\)\{\s*\n\s*return splitSelfTouchingRing\(ring\)\.filter\(r => ringArea\(r\) >= MIN_FILL_PIECE_AREA\);/.test(src));
check('fill loop iterates clippedRaw + fillPiecesOf (full coverage), not the mainRingOf-reduced clipped list',
  /clippedRaw\.forEach\(\(\{geom\}\)=>\{/.test(src) && /fillPiecesOf\(geom\.coordinates\[0\]\)\.forEach\(piece=>\{/.test(src) && /fillPiecesOf\(ringSet\[0\]\)\.forEach\(piece=>\{/.test(src));
check('outline/centroid pass is untouched — still built from the mainRingOf-reduced clipped list, not clippedRaw',
  /clipped\.forEach\(\(\{name, geom\}\)=>\{/.test(src));

sectionHeader('v1.14.0 — canopy LOD (fix muddy graphics) + legend visibility toggles');
check('crisp far-LOD dot texture exists, distinct from the soft near-zoom one',
  /function makeCrispDotTexture\(\)/.test(src) && /function getCrispDotTexture\(\)/.test(src));
check('forestPointsFar scene object + its own index-aligned record-ref array exist',
  /let forestLines = null, forestPoints = null, forestPointsFar = null;/.test(src) &&
  /let pointRecordRefsFar = \[\];/.test(src));
check('far-LOD canopy set is a real decimation of the full point set (1-in-N stride), not a full duplicate',
  /const CANOPY_FAR_STRIDE = 3;/.test(src) && /if\(i % CANOPY_FAR_STRIDE === 0\)\{/.test(src));
check('far-LOD dot size is boosted to compensate for the sparser sample',
  /farSize\.push\(out\.pointSize\[i\] \* CANOPY_FAR_SIZE_MULT\);/.test(src));
check('far-LOD material uses alphaTest (hard cutoff) instead of relying purely on soft blending',
  /alphaTest:0\.45/.test(src));
check('far-LOD material writes depth, unlike the near/full-detail set (lets nearer canopy properly occlude farther canopy instead of blending through it)',
  /depthWrite:true/.test(src));
check('updateCanopyLOD exists and is invoked from inside updateBranchVisibility (single call site, no separate wiring needed)',
  /function updateCanopyLOD\(\)/.test(src) &&
  /function updateBranchVisibility\(\)\{\s*\n\s*if\(forestLines\) forestLines\.visible = camDist < BRANCH_VISIBLE_MAX_DIST;\s*\n\s*updateCanopyLOD\(\);/.test(src));
check('canopy LOD switches at the same BRANCH_VISIBLE_MAX_DIST threshold branches already use, not a separate magic number',
  /const near = camDist < BRANCH_VISIBLE_MAX_DIST;/.test(src));
check('click-to-inspect raycasts against whichever LOD mesh is actually visible, using its matching record-ref array',
  /const usingFar = forestPointsFar && forestPointsFar\.visible;/.test(src) &&
  /raycaster\.intersectObject\(forestPointsFar\)/.test(src) &&
  /raycaster\.intersectObject\(forestPoints\)/.test(src));
check('legend swatches are real toggle buttons (not inert spans), tracked per color-mode via hiddenHealth/hiddenSpecies',
  /const hiddenHealth = new Set\(\);/.test(src) && /const hiddenSpecies = new Set\(\);/.test(src) &&
  /class="item\$\{off\?' off':''\}" data-cat-mode="health"/.test(src) &&
  /class="item\$\{off\?' off':''\}" data-cat-mode="species"/.test(src));
check('"more species" bucket is individually toggleable via the literal __other__ key, consistent with topSpeciesSet\'s own convention',
  /data-cat-key="__other__"/.test(src));
check('rebuildForest filters hidden categories out of the actual tree geometry (trunk + canopy), not just their legend color (v1.15.0 superseded this with an added size-filter clause — see the v1.15.0 section below for the current check)',
  /const visibleRecords = records\.filter\(rec => !isCategoryHidden\(rec, topSet\) && !isSizeHidden\(rec\)\);/.test(src) &&
  /visibleRecords\.forEach\(rec=>\{/.test(src));
check('topSpeciesSet/category membership is computed from the FULL unfiltered sample, so toggling a category never changes what counts as "top" or shifts legend percentages',
  /const topSet = colorMode === 'species' \? topSpeciesSet\(records\) : null;/.test(src));
check('reset-filters control only appears once something is actually hidden, and clears both filter sets together',
  /function resetFiltersMarkup\(show\)\{/.test(src) &&
  /hiddenHealth\.clear\(\); hiddenSpecies\.clear\(\);/.test(src));
check('stat line reflects a filtered view distinctly from the unfiltered "trees loaded" state',
  /`<b>\$\{visibleRecords\.length\.toLocaleString\(\)\}<\/b> of <b>\$\{records\.length\.toLocaleString\(\)\}<\/b> trees shown`/.test(src));

sectionHeader('v1.14.1 — coastline ghost-line fix + camera-relative horizon fog');
check('exteriorSegKeySet is captured from the raw (pre-largestConnectedComponent) dissolve, so it reflects every true coastline edge, not just the largest connected loop',
  /const exteriorSegKeySet = new Set\(outerSegsRaw\.map\(\(\[a,b\]\) => segKey\(a,b\)\)\);/.test(src));
check('bufferedXZ classifies vertices by adjacent-edge exteriority instead of buffering every vertex uniformly',
  /function bufferedXZ\(ring, eps, exteriorKeySet\)\{/.test(src) &&
  /if\(edgeExterior\[prevEdgeIdx\] && edgeExterior\[nextEdgeIdx\]\) return new THREE\.Vector2\(p\.x, p\.z\);/.test(src));
check('bufferedXZ wraparound handles the closed-ring duplicate endpoint (vertex 0 === vertex n-1) so both compute the same exterior flag',
  /const prevEdgeIdx = i === 0 \? n-2 : i-1;/.test(src) && /const nextEdgeIdx = i === n-1 \? 0 : i;/.test(src));
check('scene.fog exists (v1.14.2 superseded its initial --canvas-bg color source with --sky-horizon — see the v1.14.2 section below for the current check)',
  /scene\.fog = new THREE\.Fog\(getComputedColor\('--sky-horizon'\), 1, 1\);/.test(src));
check('fog distance is camera-relative and rescaled on every updateCamera call, not a fixed world-unit constant (a fixed value can\'t work at every zoom level, since camDist itself ranges from ~80 to ~2200)',
  /function updateFog\(\)\{/.test(src) && /scene\.fog\.near = camDist \* 1\.4;/.test(src) && /scene\.fog\.far = camDist \* 2\.6;/.test(src));
check('fog color is kept in sync with the sky on theme toggle (v1.14.2 superseded the direct flat-recolor call checked here originally — see the v1.14.2 section below for the current call site)',
  /function applySkyBackground\(\)\{/.test(src));
check('water material fog decision (v1.14.5 superseded fog:true with fog:false — see the v1.14.5 section below for the current check)',
  /const waterMat = new THREE\.MeshBasicMaterial\(\{map: makeWaterTexture\(\), depthWrite: false, fog: false\}\);/.test(src));
check('fog scope is deliberate (v1.14.3 superseded "no material opts out" with the opposite policy, then v1.14.5 superseded that too — every material including water now opts out; see the v1.14.5 section below for the current checks)',
  /const waterMat = new THREE\.MeshBasicMaterial\(\{map: makeWaterTexture\(\), depthWrite: false, fog: false\}\);/.test(src));

sectionHeader('v1.14.2 — sunset sky gradient');
check('sky gradient stops defined as theme-aware CSS custom properties, same pattern as --canvas-bg',
  /--sky-top: #15101C;/.test(src) && /--sky-mid: #C9683A;/.test(src) && /--sky-horizon: #F2C879;/.test(src) &&
  /--sky-top: #0A0710;/.test(src) && /--sky-mid: #B33A1E;/.test(src) && /--sky-horizon: #D9A03D;/.test(src));
check('dark theme gets its own distinct (deeper/richer) sunset palette, not the light theme\'s stops reused verbatim',
  (src.match(/--sky-mid: #C9683A;/g) || []).length === 1 && (src.match(/--sky-mid: #B33A1E;/g) || []).length === 1);
check('sky is a real vertical gradient (three color stops via CanvasTexture), not a flat THREE.Color swap',
  /function makeSkyTexture\(\)/.test(src) &&
  /g\.addColorStop\(0, getComputedColor\('--sky-top'\)\);/.test(src) &&
  /g\.addColorStop\(0\.55, getComputedColor\('--sky-mid'\)\);/.test(src) &&
  /g\.addColorStop\(1, getComputedColor\('--sky-horizon'\)\);/.test(src));
check('sky texture dimensions are power-of-two (avoids NPOT mipmap warnings/fallback in this three.js version)',
  /const w = 8, h = 512;/.test(src));
check('applySkyBackground disposes the previous sky texture before creating a new one (theme toggle would otherwise leak a texture per switch)',
  /function applySkyBackground\(\)\{\s*\n\s*if\(skyTextureCache\) skyTextureCache\.dispose\(\);/.test(src));
check('fog color is drawn from the gradient\'s horizon stop specifically, not its top/zenith stop — that\'s the band fogged-out geometry actually sits against',
  /if\(scene && scene\.fog\) scene\.fog\.color = new THREE\.Color\(getComputedColor\('--sky-horizon'\)\);/.test(src));
check('theme toggle regenerates the sky texture (and its matching fog color) via the same applySkyBackground path used at initial scene setup, rather than a separate/divergent recolor',
  /if\(scene\) applySkyBackground\(\);/.test(src) && (src.match(/function applySkyBackground/g) || []).length === 1);
check('initScene calls applySkyBackground rather than assigning scene.background directly (single code path for building the sky, at init and on every theme toggle)',
  !/scene\.background = new THREE\.Color\(getComputedColor\('--canvas-bg'\)\);/.test(src));

sectionHeader('v1.14.3 — fog scoped to the water plane only (stop the sunset bleeding onto land)');
check('NYC land fill explicitly opts out of fog', /color: 0x3A3323, transparent: true, opacity: 1\.0, side: THREE\.DoubleSide, depthWrite: false, fog: false/.test(src));
check('context (NJ/Long Island) land fill explicitly opts out of fog', /color: 0x4A4230, transparent: true, opacity: 1\.0, side: THREE\.DoubleSide, depthWrite: false, fog: false/.test(src));
check('NYC borough outline explicitly opts out of fog', /const lineMat = new THREE\.LineBasicMaterial\(\{color:0xD6C9A9, transparent:true, opacity:0\.6, depthWrite:false, fog:false\}\);/.test(src));
check('context outline explicitly opts out of fog', /const mat = new THREE\.LineBasicMaterial\(\{color:0xD6C9A9, transparent:true, opacity:0\.6, depthWrite:false, fog:false\}\);/.test(src));
check('grid opting out of fog is moot — grid retired entirely in v1.15.5', !/new THREE\.GridHelper/.test(src));
check('branch mesh explicitly opts out of fog (trees stay crisp, not fading toward the horizon)',
  /const branchMat = new THREE\.MeshBasicMaterial\(\{vertexColors:true, side:THREE\.DoubleSide, transparent:true, opacity:0\.68, fog:false\}\);/.test(src));
check('both canopy point sets (near full-detail and far decimated) explicitly opt out of fog',
  /size:5\.2, map:getDotTexture\(\), vertexColors:true, sizeAttenuation:true,\s*\n\s*transparent:true, opacity:0\.95, depthWrite:false, fog:false/.test(src) &&
  /size:8\.5, map:getCrispDotTexture\(\), vertexColors:true, sizeAttenuation:true,\s*\n\s*transparent:true, opacity:1\.0, alphaTest:0\.45, depthWrite:true, fog:false/.test(src));
check('water plane material was the one exception at this point in the history — still had fog:true here (v1.14.5 later removed even this — see the v1.14.5 section below)',
  /const waterMat = new THREE\.MeshBasicMaterial\(\{map: makeWaterTexture\(\), depthWrite: false, fog: false\}\);/.test(src));

sectionHeader('v1.14.4 — water plane enlarged past the camera\'s own far-clip distance');
check('water plane is sized well past the camera\'s max zoom-out distance, not just modestly bigger than WORLD_SIZE',
  /const waterGeo = new THREE\.PlaneGeometry\(WORLD_SIZE \* 10, WORLD_SIZE \* 10\);/.test(src));
check('plane half-width (WORLD_SIZE * 10 / 2 = 6000) exceeds the camera\'s far-clip distance (4000), so its edge is structurally unreachable regardless of camDist or angle',
  /camera = new THREE\.PerspectiveCamera\(42, 1, 1, 4000\);/.test(src) && /const waterGeo = new THREE\.PlaneGeometry\(WORLD_SIZE \* 10, WORLD_SIZE \* 10\);/.test(src));
check('plane half-width also exceeds camDist\'s own max clamp (2200) — the actual root cause (camera could orbit past the old plane\'s edge), not just a far-clip coincidence',
  /camDist = Math\.max\(80, Math\.min\(2200, camDist - \(d - lastPinchDist\) \* 1\.8\)\);/.test(src) && /camDist = Math\.max\(80, Math\.min\(2200, camDist \+ e\.deltaY \* 0\.5\)\);/.test(src) && /WORLD_SIZE \* 10/.test(src));

sectionHeader('v1.14.5 — fog fully retired from every material, including water');
check('water material now explicitly opts OUT of fog, matching every other material in the scene',
  /const waterMat = new THREE\.MeshBasicMaterial\(\{map: makeWaterTexture\(\), depthWrite: false, fog: false\}\);/.test(src));
check('no material anywhere in the scene still has fog:true (fog is fully inert as of this version)',
  !/fog:\s*true/.test(src.replace(/CHANGELOG[\s\S]*?-->/, '')));
check('scene.fog itself is left in place rather than torn out (documented as intentionally inert, not an oversight)',
  /scene\.fog = new THREE\.Fog\(getComputedColor\('--sky-horizon'\), 1, 1\);/.test(src) && /no material in the scene uses it\./.test(src));

sectionHeader('v1.15.0 — trunk size filter + Season canopy color mode');
check('SIZE_CLASSES defines three non-overlapping, exhaustive DBH buckets',
  /const SIZE_CLASSES = \[/.test(src) && /d <= 6/.test(src) && /d > 6 && d <= 18/.test(src) && /d > 18/.test(src));
check('hiddenSizeClass is tracked independently of hiddenHealth/hiddenSpecies, not folded into colorMode-specific state',
  /const hiddenSizeClass = new Set\(\);/.test(src) && /function isSizeHidden\(rec\)\{/.test(src));
check('size filter combines with (does not replace) the category filter in rebuildForest',
  /const visibleRecords = records\.filter\(rec => !isCategoryHidden\(rec, topSet\) && !isSizeHidden\(rec\)\);/.test(src));
check('Trunk size row renders three toggle buttons, defaulting all to active (shown)',
  /function renderSizeRow\(\)\{/.test(src) && /const off = hiddenSizeClass\.has\(key\);/.test(src));
check('Trunk size row is wired up at boot alongside the other control rows',
  /renderColorModeRow\(\);\s*\n\s*renderSizeRow\(\);\s*\n\s*renderViewModeRow\(\);/.test(src));
check('Season is a third colorMode option, distinct from health/species',
  /\['season','Season','Purely a display style, not real data — canopy recolored by time of year'\]/.test(src));
check('isCategoryHidden short-circuits for season mode (nothing to hide — season has no per-tree category)',
  /if\(colorMode === 'season'\) return false; \/\/ season is a display style, not a per-tree category — nothing to hide by/.test(src));
check('season color is picked from a seed OFFSET from the tree\'s real seed, not an extra rng() call spliced into the growth stream (which would reshape branch geometry every time the season changed)',
  /const SEASON_SEED_OFFSET = 0x51ED270B;/.test(src) &&
  /function seasonColor\(seed, season\)\{/.test(src) &&
  /const pick = mulberry32\(seed \^ SEASON_SEED_OFFSET\)\(\);/.test(src) &&
  !/mulberry32\(seed \^ SEASON_SEED_OFFSET\)\(\)[\s\S]{0,40}rng\(/.test(src));
check('growTree passes the tree\'s real seed (not a re-derived one) into seasonColor, and only when colorMode is actually season',
  /canopyColor = seasonColor\(seed, out\.season\);/.test(src));
check('season picker in the legend is single-select (one active season) via a distinct season-item class, not the toggle-hide .item.off treatment used by health/species',
  /class="item season-item\$\{active\?' active':''\}"/.test(src) &&
  /\.legend \.item\.season-item\.active\{/.test(src));
check('season picker click handler updates selectedSeason and rebuilds, separately from the category-toggle handler',
  /legend\.querySelectorAll\('button\.season-item'\)\.forEach\(btn=>\{/.test(src) &&
  /selectedSeason = btn\.dataset\.season;/.test(src));
check('rebuildForest passes the current season through to growTree via out.season',
  /season: selectedSeason/.test(src));
check('help modal documents both new features (Season mode has nothing to toggle; Trunk size is independent of/combinable with the color-mode legend)',
  /Canopy color — Season<\/b>: purely a display style/.test(src) && /<b>Trunk size<\/b> filters by real trunk diameter/.test(src));

sectionHeader('v1.15.1 — Recenter now targets NYC\'s real centroid, not the padded box\'s center');
check('syncDefaultTargetToBoroughs computes the centroid from real boroughLabels positions, not a hardcoded/guessed lat-lon',
  /function syncDefaultTargetToBoroughs\(\)\{/.test(src) &&
  /const cx = boroughLabels\.reduce\(\(sum,b\) => sum \+ b\.pos\.x, 0\) \/ boroughLabels\.length;/.test(src) &&
  /const cz = boroughLabels\.reduce\(\(sum,b\) => sum \+ b\.pos\.z, 0\) \/ boroughLabels\.length;/.test(src));
check('DEFAULT_TARGET is corrected in place (mutated via .set, not reassigned — it\'s a const) after boroughLabels is populated',
  /buildLabelEls\(\);\s*\n\s*syncDefaultTargetToBoroughs\(\);/.test(src) &&
  /DEFAULT_TARGET\.set\(cx, 40, cz\);/.test(src));
check('camTarget only follows the corrected DEFAULT_TARGET if it was still at the untouched default — a pan made while boundary data was loading is never silently overwritten',
  /const wasAtOldDefault = camTarget\.distanceTo\(DEFAULT_TARGET\) < 0\.01;/.test(src) &&
  /if\(wasAtOldDefault\)\{\s*\n\s*camTarget\.copy\(DEFAULT_TARGET\);\s*\n\s*updateCamera\(\);\s*\n\s*\}/.test(src));
check('the fix runs exactly once per load (buildBoundaryGeometry, hence syncDefaultTargetToBoroughs, is only ever called from loadBoroughBoundaries)',
  (src.match(/buildBoundaryGeometry\(/g) || []).length === 3 && /async function loadBoroughBoundaries\(\)\{/.test(src));

sectionHeader('v1.15.2 — subtitle updated, consistent everywhere it appears');
check('header <p> subtitle updated', /<p>NYC's Street Trees, Grown From the Census<\/p>/.test(src));
check('<title> updated to match', /<title>STAND — NYC's Street Trees, Grown From the Census<\/title>/.test(src));
check('meta description updated to match', /<meta name="description" content="NYC's street trees, grown from the census/.test(src));
check('top-of-file project tagline comment updated to match', /NYC's Street Trees, Grown From the Census — one branching structure per real tree record\./.test(src));
check('old subtitle wording fully retired (only survives in changelog prose, not live markup/meta)',
  !/NYC Street Tree Census · Grown Back as a Forest/.test(src) &&
  !/NYC's Street Tree Census grown back as a procedural forest/.test(src));
check('STAND name itself is unchanged everywhere (h1, title, footer) — only the subtitle changed',
  /<h1>STAND<\/h1>/.test(src) && /STAND · v\$\{APP_VERSION\}/.test(src));

sectionHeader('v1.15.3/1.15.4 — Westchester context + consolidated county source');
check('Westchester context loader exists', /async function loadWestchesterContext/.test(src));
check('all three context loaders (NJ, Westchester, Long Island) share one memoized fetch', /let contextCountiesPromise = null;/.test(src));
check('NJ, Westchester, and Long Island are all filtered from the same shared feature list, not separate fetches',
  /await loadContextCounties\(\)/.test(src) && (src.match(/await loadContextCounties\(\)/g) || []).length === 3);

sectionHeader('v1.15.5 — grid retired (orphaned scale bug + no longer earning its place)');
check('GridHelper fully removed from the scene', !/new THREE\.GridHelper/.test(src));
check('groundGrid dead variable removed along with it', !/groundGrid\s*=/.test(src));
check('water plane and its gradient texture remain untouched by the grid removal', /function makeWaterTexture/.test(src) && /const waterGeo = new THREE\.PlaneGeometry\(WORLD_SIZE \* 10, WORLD_SIZE \* 10\);/.test(src));

sectionHeader('v1.15.6/1.15.7 — OSM Overpass attempt (superseded — see v1.15.8 rollback below)');
check('OSM path fully removed: no OSM-related identifiers survive in live code (loadOsmContext, stitchWaysIntoRings, osmElementsToFeatures, OSM_OVERPASS_URL)',
  !/function loadOsmContext\(\)/.test(src) && !/function stitchWaysIntoRings/.test(src) &&
  !/function osmElementsToFeatures/.test(src) && !/const OSM_OVERPASS_URL/.test(src));

sectionHeader('v1.15.8 — OSM attempt rolled back to last visually-confirmed version (v1.15.5)');
check('all three loaders are back to a single try block against the county-file path, no OSM attempt layered on top',
  (src.match(/await loadContextCounties\(\)/g) || []).length === 3 &&
  !/falling back to county data/.test(src));
check('NJ_OSM_COUNTIES / loadOsmContext call sites fully gone from loadStateContext and friends',
  !/NJ_OSM_COUNTIES/.test(src) && !/await loadOsmContext\(\)/.test(src));
check('contextCountiesPromise (the v1.15.4 shared county fetch) still intact and untouched by the rollback',
  /let contextCountiesPromise = null;/.test(src) && /function loadContextCounties\(\)\{/.test(src));

sectionHeader('v1.16.0 — multi-year census support (2005 + 2015)');
check('CENSUS_YEARS config exists with both 2005 and 2015 entries', /const CENSUS_YEARS = \{/.test(src) && /2015: \{/.test(src) && /2005: \{/.test(src));
check('2005 correctly maps its single status column to health, with no fabricated alive/dead filter',
  /healthField: 'status'/.test(src) && !/status='Alive'.*29bw-z7pj|29bw-z7pj[\s\S]{0,200}status='Alive'/.test(src));
check('1995 deliberately excluded, not silently guessed at', !/1995:\s*\{/.test(src) && /1995 deliberately NOT included/.test(src));
check('fetchSample is parameterized by year (no hardcoded SODA_BASE/dataset id left over)',
  /async function fetchSample\(year, borough, offset, limit\)/.test(src) && !/const SODA_BASE/.test(src));
check('cache key includes census year so switching years doesn\'t collide with or skip a borough\'s cache',
  /const key = activeYear \+ ':' \+ borough;/.test(src));
check('renderYearRow exists and is wired into boot alongside the other control rows',
  /function renderYearRow\(\)\{/.test(src) && /renderYearRow\(\);/.test(src));
check('selectYear now delegates to growToYear (animated crossfade) instead of an instant reload — v1.16.1 superseded the instant-swap version',
  /async function selectYear\(y\)\{\s*\n\s*await growToYear\(y\);/.test(src));
check('per-tree info card surfaces which census year a clicked record came from',
  /<span>Census<\/span><span>\$\{escapeHtml\(String\(rec\.censusYear/.test(src));
check('synthetic offline fallback still works per-year (tagged with censusYear, not silently defaulted)',
  /function syntheticSample\(borough, year\)\{/.test(src) && /censusYear: year/.test(src));

sectionHeader('v1.16.1 — animated "watch it grow" transition between census years');
check('buildForestLayer exists as a standalone twin of rebuildForest, not a refactor of it',
  /function buildForestLayer\(records\)\{/.test(src) && /function disposeForestLayer\(layer\)\{/.test(src));
check('rebuildForest itself is untouched by the new feature (still starts with hideTreeInfo, still disposes forestLines/forestPoints/forestPointsFar directly)',
  /function rebuildForest\(records\)\{\s*\n\s*hideTreeInfo\(\)/.test(src) &&
  /if\(forestLines\)\{ scene\.remove\(forestLines\); forestLines\.geometry\.dispose\(\); forestLines\.material\.dispose\(\); \}/.test(src));
check('growToYear guards against re-entry (growing flag) and against animating from nothing on first load',
  /let growing = false;/.test(src) && /if\(growing \|\| targetYear === activeYear\) return;/.test(src) &&
  /if\(!forestLines \|\| !forestPoints \|\| !forestPointsFar\)\{/.test(src));
check('crossfade animates opacity + canopy point size, never scale/position (avoids dragging trees toward world origin)',
  /newLayer\.points\.material\.size = newBaseSize\.points \* \(0\.15 \+ 0\.85 \* e\);/.test(src) &&
  !/newLayer\.(lines|points|pointsFar)\.scale\./.test(src));
check('old layer is disposed only after the animation completes, never mid-transition',
  /disposeForestLayer\(oldLayer\);[\s\S]{0,40}forestLines = newLayer\.lines;/.test(src));
check('interaction is blocked during the transition via the .growing class on controlPanel, added and removed symmetrically',
  (src.match(/getElementById\('controlPanel'\)\.classList\.(add|remove)\('growing'\)/g) || []).length === 2);
check('"Watch it grow" button exists and always plays the full 2005\u21922015 arc',
  /async function playGrowth\(\)\{/.test(src) && /activeYear = 2005;/.test(src) && /await growToYear\(2015\);/.test(src));
check('help modal is honest that this is a census-to-census crossfade, not a per-tree growth simulation',
  /not a per-tree growth simulation/.test(src));

sectionHeader('v1.16.3 — button modernization: hover/transitions + segmented-control toggle groups');
check('.btn has a transition property (was entirely missing — every state change used to be an instant snap)',
  /\.btn\{[\s\S]{0,300}transition:background-color \.15s ease/.test(src));
check('.btn has a real :hover rule, distinct for secondary vs. filled buttons, excluded for .active/:disabled',
  /\.btn\.secondary:hover:not\(\.active\):not\(:disabled\)\{/.test(src) &&
  /\.btn:not\(\.secondary\):hover:not\(\.active\):not\(:disabled\)\{/.test(src));
check('press feedback (:active translateY) exists on buttons', /\.btn:active:not\(:disabled\)\{transform:translateY\(1px\);\}/.test(src));
check('all five toggle-group rows (Borough, Census year, Canopy color, Trunk size, View) use the segmented-control class',
  ['boroughRow','yearRow','colorModeRow','sizeRow','viewModeRow'].every(id => new RegExp(`<div class="row segmented" id="${id}"></div>`).test(src)));
check('standalone action buttons (Reseed, Recenter, Watch it grow) are NOT segmented — stay separate pills, not folded into a toggle group',
  !/row segmented"[^>]*>\s*<button[^>]*id="(reseedBtn|recenterBtn|growBtn)"/.test(src));
check('segmented rows override the base .row gap to 0 (buttons sit flush, separated by divider not whitespace)',
  /\.row\.segmented\{[\s\S]{0,120}gap:0;/.test(src));
check('segmented buttons use a divider (border-right) between them instead of individual borders on every button',
  /\.row\.segmented \.btn:not\(:last-child\)\{border-right:1\.5px solid var\(--line\);\}/.test(src) &&
  /\.row\.segmented \.btn\{[\s\S]{0,80}border:none;/.test(src));
check('zero border-radius / sharp-corner brand language preserved — not touched by this change',
  /border-radius:0/.test(src));

/* ===================== Summary ===================== */
console.log(`\n${BOLD}${'-'.repeat(40)}${RESET}`);
console.log(`${GREEN}${pass} passed${RESET}, ${fail ? RED : DIM}${fail} failed${RESET}`);
if(fail){
  console.log(`\n${RED}${BOLD}Failures:${RESET}`);
  failures.forEach(f => console.log(`  ${RED}✗${RESET} ${f}`));
  process.exit(1);
} else {
  console.log(`${GREEN}All checks passed — clear to ship.${RESET}`);
  process.exit(0);
}
