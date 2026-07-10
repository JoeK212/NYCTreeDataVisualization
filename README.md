# STAND

NYC's 2015 Street Tree Census, grown back as a procedural forest. Every
structure in the scene is a seeded L-system branch tree generated from one
real tree record — species, diameter, health, and location all come from
live NYC Open Data.

Live: (add Netlify URL once deployed)

Built by Joe.K · [axisbim.io](https://axisbim.io)

## Data

Fetched client-side from the NYC Open Data Socrata API
([2015 Street Tree Census — Tree Data](https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh),
dataset `uvpi-gqnh`). No backend, no API key — a plain `fetch()` against the
public SODA endpoint. If the request fails (offline, network restrictions),
the app falls back to a synthetic sample so the scene still renders.

## How a tree is grown

Each record's `tree_id` seeds a `mulberry32` PRNG, so the same tree always
grows the same shape. Diameter (`tree_dbh`) drives height and branch-recursion
depth; species drives branch-angle character; health colors the canopy.
Branch lines and canopy points are each batched into a single draw call
across the whole sample, so it stays smooth at a few thousand trees.
