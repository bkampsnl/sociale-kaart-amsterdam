# Amsterdam Wijkveiligheid Dashboard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React web app with an interactive map of Amsterdam neighborhoods, color-coded by safety/vulnerability, with search and filtering.

**Architecture:** Single-page React+Vite app, Leaflet map, direct API calls to api.data.amsterdam.nl, no backend.

**Tech Stack:** React, Vite, Leaflet, react-leaflet, proj4 (coordinate conversion)

---

### Task 1: Scaffold React + Vite project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/App.css`

**Step 1: Initialize Vite project**

Run: `cd /home/vortexadmin/data-adam && npm create vite@latest . -- --template react`
Expected: Project scaffolded

**Step 2: Install dependencies**

Run: `cd /home/vortexadmin/data-adam && npm install leaflet react-leaflet proj4`
Expected: Dependencies installed

**Step 3: Verify dev server starts**

Run: `cd /home/vortexadmin/data-adam && npx vite --host 0.0.0.0 &` then `sleep 3 && curl -s http://localhost:5173 | head -5`
Expected: HTML response

**Step 4: Stop dev server and commit**

```bash
kill %1 2>/dev/null
git init
git add -A
git commit -m "chore: scaffold React+Vite project with leaflet and proj4"
```

---

### Task 2: Create API service layer

**Files:**
- Create: `src/api.js`

**Step 1: Write the API service**

```javascript
const BASE = 'https://api.data.amsterdam.nl/v1';

// Fetch all GGW-gebieden with geometries
export async function fetchGebieden() {
  const all = [];
  let url = `${BASE}/gebieden/ggwgebieden/?_format=json&_pageSize=100`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    all.push(...data._embedded.ggwgebieden);
    url = data._links.next?.href || null;
  }
  return all;
}

// BBGA indicators we use
export const INDICATORS = [
  { id: 'VMISDRIJF_1000INW', label: 'Misdrijven per 1.000 inwoners', category: 'criminaliteit', higherIsWorse: true },
  { id: 'VBUURTVEILIG_R', label: 'Veiligheid buurt (1-10)', category: 'veiligheid', higherIsWorse: false },
  { id: 'LOVERL_P', label: 'Overlast: % veel', category: 'overlast', higherIsWorse: true },
  { id: 'SKKWETS34_P', label: 'Kwetsbaarheidsscore hoog (%)', category: 'kwetsbaarheid', higherIsWorse: true },
  { id: 'LSOCCOH_R', label: 'Sociale cohesie (1-10)', category: 'sociaal', higherIsWorse: false },
  { id: 'SKSES234_P', label: 'SES laag (%)', category: 'kwetsbaarheid', higherIsWorse: true },
  { id: 'VDRUGSGEBR_P', label: 'Overlast: drugsgebruik (%)', category: 'overlast', higherIsWorse: true },
  { id: 'LJONGERENOVL_P', label: 'Overlast: jongeren (%)', category: 'overlast', higherIsWorse: true },
  { id: 'VCRIMI_P', label: 'Criminaliteit: % veel', category: 'criminaliteit', higherIsWorse: true },
];

// Fetch kerncijfers for one indicator, most recent year
export async function fetchKerncijfers(indicatorId, jaar = 2024) {
  const all = [];
  let url = `${BASE}/bbga/kerncijfers/?indicatorDefinitieId=${indicatorId}&jaar=${jaar}&_pageSize=100&_format=json`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    all.push(...data._embedded.kerncijfers);
    url = data._links.next?.href || null;
  }
  // fallback to previous year if empty
  if (all.length === 0 && jaar > 2022) {
    return fetchKerncijfers(indicatorId, jaar - 1);
  }
  return all;
}

// Fetch all kerncijfers for all indicators
export async function fetchAllKerncijfers() {
  const results = {};
  await Promise.all(
    INDICATORS.map(async (ind) => {
      const data = await fetchKerncijfers(ind.id);
      results[ind.id] = {};
      for (const row of data) {
        results[ind.id][row.gebiedcode15] = row.waarde;
      }
    })
  );
  return results;
}

// Fetch meldingen summary per GGW-gebied
export async function fetchMeldingen(ggwCode, limit = 100) {
  const url = `${BASE}/meldingen/meldingen/?gbdGgwgebiedCode=${ggwCode}&_pageSize=${limit}&_format=json&_sort=-datumMelding`;
  const res = await fetch(url);
  const data = await res.json();
  return data._embedded.meldingen;
}

// Fetch meldingen counts by hoofdcategorie for a gebied
export async function fetchMeldingenByCategorie(ggwCode) {
  const meldingen = await fetchMeldingen(ggwCode, 500);
  const counts = {};
  for (const m of meldingen) {
    const cat = m.subcategorie || m.hoofdcategorie;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  // sort by count descending
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([categorie, aantal]) => ({ categorie, aantal }));
}
```

**Step 2: Commit**

```bash
git add src/api.js
git commit -m "feat: add API service layer for Amsterdam open data"
```

---

### Task 3: Create coordinate conversion utility

**Files:**
- Create: `src/geo.js`

**Step 1: Write the RD to WGS84 converter**

```javascript
import proj4 from 'proj4';

// Define RD New (Amersfoort) projection
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957388243134,0.343987817378283,-1.87740163998045,4.0725 +units=m +no_defs');

// Convert a single coordinate pair from RD to WGS84
function rdToWgs84(x, y) {
  const [lng, lat] = proj4('EPSG:28992', 'WGS84', [x, y]);
  return [lat, lng]; // Leaflet uses [lat, lng]
}

// Convert RD GeoJSON coordinates to WGS84
// Returns GeoJSON-style [lng, lat] pairs
function convertCoords(coords) {
  if (typeof coords[0] === 'number') {
    const [lat, lng] = rdToWgs84(coords[0], coords[1]);
    return [lng, lat]; // GeoJSON uses [lng, lat]
  }
  return coords.map(convertCoords);
}

// Convert a gebieden geometry object to WGS84 GeoJSON
export function convertGeometry(geometry) {
  return {
    type: geometry.type,
    coordinates: convertCoords(geometry.coordinates),
  };
}

// Convert all gebieden to GeoJSON FeatureCollection
export function gebiedenToGeoJSON(gebieden) {
  return {
    type: 'FeatureCollection',
    features: gebieden
      .filter((g) => g.geometrie)
      .map((g) => ({
        type: 'Feature',
        properties: {
          code: g.code,
          naam: g.naam,
          identificatie: g.identificatie,
        },
        geometry: convertGeometry(g.geometrie),
      })),
  };
}
```

**Step 2: Commit**

```bash
git add src/geo.js
git commit -m "feat: add RD to WGS84 coordinate conversion"
```

---

### Task 4: Build the Map component

**Files:**
- Create: `src/components/MapView.jsx`

**Step 1: Write MapView component**

```jsx
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { useRef, useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';

// Color scale: green → yellow → red based on normalized value (0-1)
function getColor(value, higherIsWorse) {
  if (value == null) return '#666';
  // Normalize: 0 = best, 1 = worst
  const v = higherIsWorse ? value : 1 - value;
  if (v < 0.25) return '#2d8a4e';  // green
  if (v < 0.5) return '#a3be4c';   // light green
  if (v < 0.75) return '#f0a030';  // orange
  return '#d32f2f';                // red
}

export default function MapView({ geojson, kerncijfers, selectedIndicator, selectedGebied, onSelectGebied }) {
  const geoJsonRef = useRef();

  // Compute normalized values for the selected indicator
  const normalized = useMemo(() => {
    if (!kerncijfers || !selectedIndicator) return {};
    const values = kerncijfers[selectedIndicator.id] || {};
    const nums = Object.values(values).filter((v) => v != null);
    if (nums.length === 0) return {};
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    const result = {};
    for (const [code, val] of Object.entries(values)) {
      result[code] = (val - min) / range;
    }
    return result;
  }, [kerncijfers, selectedIndicator]);

  // Style each feature
  const style = (feature) => {
    const code = feature.properties.code;
    const value = normalized[code];
    const isSelected = selectedGebied?.code === code;
    return {
      fillColor: getColor(value, selectedIndicator?.higherIsWorse),
      weight: isSelected ? 3 : 1,
      color: isSelected ? '#fff' : '#444',
      fillOpacity: isSelected ? 0.9 : 0.7,
    };
  };

  const onEachFeature = (feature, layer) => {
    layer.on('click', () => {
      onSelectGebied(feature.properties);
    });
    layer.bindTooltip(feature.properties.naam, { sticky: true });
  };

  // Re-style when selection or indicator changes
  useEffect(() => {
    if (geoJsonRef.current) {
      geoJsonRef.current.setStyle(style);
    }
  }, [normalized, selectedGebied]);

  if (!geojson) return <div className="map-loading">Kaart laden...</div>;

  return (
    <MapContainer
      center={[52.37, 4.895]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <GeoJSON
        key={selectedIndicator?.id || 'default'}
        ref={geoJsonRef}
        data={geojson}
        style={style}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/MapView.jsx
git commit -m "feat: add MapView component with color-coded GeoJSON"
```

---

### Task 5: Build the Detail Panel component

**Files:**
- Create: `src/components/DetailPanel.jsx`

**Step 1: Write DetailPanel component**

```jsx
import { useState, useEffect } from 'react';
import { INDICATORS, fetchMeldingenByCategorie } from '../api';

export default function DetailPanel({ gebied, kerncijfers }) {
  const [meldingen, setMeldingen] = useState(null);
  const [loadingMeldingen, setLoadingMeldingen] = useState(false);

  useEffect(() => {
    if (!gebied) return;
    setLoadingMeldingen(true);
    setMeldingen(null);
    fetchMeldingenByCategorie(gebied.code)
      .then(setMeldingen)
      .finally(() => setLoadingMeldingen(false));
  }, [gebied?.code]);

  if (!gebied) {
    return (
      <div className="detail-panel empty">
        <h2>Amsterdam Wijkveiligheid</h2>
        <p>Klik op een wijk in de kaart of zoek hierboven.</p>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <h2>{gebied.naam}</h2>
      <p className="gebied-code">{gebied.code}</p>

      <h3>Kerncijfers</h3>
      <div className="stats-grid">
        {INDICATORS.map((ind) => {
          const val = kerncijfers?.[ind.id]?.[gebied.code];
          return (
            <div key={ind.id} className="stat-card">
              <span className="stat-label">{ind.label}</span>
              <span className={`stat-value ${getStatClass(val, ind)}`}>
                {val != null ? formatValue(val, ind) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <h3>Recente meldingen (top categorieën)</h3>
      {loadingMeldingen && <p className="loading">Laden...</p>}
      {meldingen && (
        <div className="meldingen-list">
          {meldingen.slice(0, 15).map((m, i) => (
            <div key={i} className="melding-row">
              <span className="melding-cat">{m.categorie}</span>
              <span className="melding-count">{m.aantal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(val, indicator) {
  if (indicator.id.endsWith('_R')) return val.toFixed(1);
  if (indicator.id.endsWith('_P')) return `${val.toFixed(1)}%`;
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}

function getStatClass(val, indicator) {
  if (val == null) return '';
  // For these specific indicators, determine severity
  const allValues = [val]; // We'd need all values for proper normalization
  // Simple heuristic based on known scales
  if (indicator.higherIsWorse) {
    // Higher = worse (overlast %, misdrijven, etc)
    return '';
  }
  return '';
}
```

**Step 2: Commit**

```bash
git add src/components/DetailPanel.jsx
git commit -m "feat: add DetailPanel with kerncijfers and meldingen"
```

---

### Task 6: Build SearchBar component with autocomplete

**Files:**
- Create: `src/components/SearchBar.jsx`

**Step 1: Write SearchBar component**

```jsx
import { useState, useRef, useEffect } from 'react';
import { INDICATORS } from '../api';

export default function SearchBar({ gebieden, onSelectGebied, selectedIndicator, onSelectIndicator }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }
    const q = query.toLowerCase();
    const matches = gebieden
      .filter((g) => g.naam.toLowerCase().includes(q) || g.code.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
  }, [query, gebieden]);

  const handleSelect = (gebied) => {
    setQuery(gebied.naam);
    setShowSuggestions(false);
    onSelectGebied({ code: gebied.code, naam: gebied.naam, identificatie: gebied.identificatie });
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder="Zoek wijk..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((g) => (
              <li key={g.code} onClick={() => handleSelect(g)}>
                <span className="suggestion-name">{g.naam}</span>
                <span className="suggestion-code">{g.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <select
        value={selectedIndicator?.id || ''}
        onChange={(e) => {
          const ind = INDICATORS.find((i) => i.id === e.target.value);
          onSelectIndicator(ind);
        }}
      >
        {INDICATORS.map((ind) => (
          <option key={ind.id} value={ind.id}>
            {ind.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SearchBar.jsx
git commit -m "feat: add SearchBar with autocomplete and indicator filter"
```

---

### Task 7: Wire up App.jsx with all components

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Step 1: Write App.jsx**

```jsx
import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import DetailPanel from './components/DetailPanel';
import SearchBar from './components/SearchBar';
import { fetchGebieden, fetchAllKerncijfers, INDICATORS } from './api';
import { gebiedenToGeoJSON } from './geo';

export default function App() {
  const [gebieden, setGebieden] = useState([]);
  const [geojson, setGeojson] = useState(null);
  const [kerncijfers, setKerncijfers] = useState(null);
  const [selectedGebied, setSelectedGebied] = useState(null);
  const [selectedIndicator, setSelectedIndicator] = useState(INDICATORS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [geb, kc] = await Promise.all([fetchGebieden(), fetchAllKerncijfers()]);
        setGebieden(geb);
        setGeojson(gebiedenToGeoJSON(geb));
        setKerncijfers(kc);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (error) return <div className="error">Fout bij laden: {error}</div>;

  return (
    <div className="app">
      <SearchBar
        gebieden={gebieden}
        onSelectGebied={setSelectedGebied}
        selectedIndicator={selectedIndicator}
        onSelectIndicator={setSelectedIndicator}
      />
      <div className="main-content">
        <div className="map-container">
          {loading ? (
            <div className="map-loading">Data laden van Amsterdam API...</div>
          ) : (
            <MapView
              geojson={geojson}
              kerncijfers={kerncijfers}
              selectedIndicator={selectedIndicator}
              selectedGebied={selectedGebied}
              onSelectGebied={setSelectedGebied}
            />
          )}
          <div className="legend">
            <span className="legend-item" style={{ background: '#2d8a4e' }}></span> Goed
            <span className="legend-item" style={{ background: '#a3be4c' }}></span> Gemiddeld
            <span className="legend-item" style={{ background: '#f0a030' }}></span> Aandacht
            <span className="legend-item" style={{ background: '#d32f2f' }}></span> Kwetsbaar
          </div>
        </div>
        <DetailPanel gebied={selectedGebied} kerncijfers={kerncijfers} />
      </div>
    </div>
  );
}
```

**Step 2: Write App.css with dark theme styling**

Full dark-theme CSS covering layout, search bar, autocomplete, detail panel, stats grid, meldingen list, legend, loading states. Two-column responsive layout with map 60% and detail panel 40%.

**Step 3: Clean up index.css and main.jsx**

Remove default Vite boilerplate styling. Ensure main.jsx imports App correctly.

**Step 4: Verify app runs**

Run: `npx vite --host 0.0.0.0`
Expected: App loads, map shows, areas are color-coded

**Step 5: Commit**

```bash
git add src/App.jsx src/App.css src/main.jsx src/index.css
git commit -m "feat: wire up complete dashboard with map, search, and detail panel"
```

---

### Task 8: Test and polish

**Step 1: Test autocomplete** — type "Bij", verify "Bijlmer" suggestions appear
**Step 2: Test map click** — click area, verify detail panel populates
**Step 3: Test indicator switch** — change dropdown, verify map colors change
**Step 4: Fix any issues found**
**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: polish and bug fixes"
```
