# Amsterdam Wijkveiligheid Dashboard - Design

## Goal
A React + Vite web app with an interactive Leaflet map of Amsterdam, color-coded by safety/vulnerability scores, with autocomplete search on neighborhood name and filtering by problem type. Selecting a neighborhood shows detailed statistics.

## Architecture
- Single-page React app, no backend — all data fetched directly from `api.data.amsterdam.nl`
- Leaflet map with GeoJSON polygons for GGW-gebieden (25 areas, right granularity)
- Color scale: green (safe) → yellow (attention) → red (vulnerable) based on selected metric
- Data cached in React state after initial load

## Data Sources (all verified working)
- **Gebieden:** `/v1/gebieden/ggwgebieden/` — 25 GGW areas with polygon geometries (RD coords → convert to WGS84 via proj4)
- **BBGA Kerncijfers:** `/v1/bbga/kerncijfers/` — statistics per area/year
- **Meldingen:** `/v1/meldingen/meldingen/` — recent reports per area

## Key Indicators (all verified with 2023/2024 data)
| Variabele | Label | Type |
|-----------|-------|------|
| VMISDRIJF_1000INW | Misdrijven per 1.000 inwoners | crime rate |
| VBUURTVEILIG_R | Veiligheid buurt (1-10) | perception |
| LOVERL_P | Overlast: % veel | nuisance |
| SKKWETS34_P | Kwetsbaarheidsscore hoog (%) | vulnerability |
| LSOCCOH_R | Sociale cohesie (1-10) | social |
| SKSES234_P | SES laag (%) | deprivation |
| VDRUGSGEBR_P | Overlast: drugsgebruik (%) | drugs |
| LJONGERENOVL_P | Overlast: jongeren (%) | youth |
| VCRIMI_P | Criminaliteit: % veel | crime perception |

## Layout
Two-column: map (left, ~60%) + detail panel (right, ~40%). Top bar with search + filters. Dark theme.

## Tech Stack
- react, vite, leaflet, react-leaflet, proj4 (for RD→WGS84)
