import { useState, useRef, useEffect } from 'react';
import { INDICATORS, searchStreets, fetchStreetGeometry, findWijkByCoord } from '../api';

export default function SearchBar({ gebieden, onSelectGebied, onSelectStreet, selectedIndicator, onSelectIndicator }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Local wijk matches (instant)
    const q = query.toLowerCase();
    const wijkMatches = gebieden
      .filter((g) => g.naam.toLowerCase().includes(q) || g.code.toLowerCase().includes(q))
      .slice(0, 5)
      .map((g) => ({ ...g, type: 'wijk' }));

    setSuggestions(wijkMatches);

    // Debounced street API search
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const streets = await searchStreets(query);
        // Deduplicate streets by name and merge with wijk results
        const seen = new Set(wijkMatches.map((w) => w.naam.toLowerCase()));
        const unique = streets.filter((s) => {
          const key = s.naam.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSuggestions((prev) => {
          const wijken = prev.filter((s) => s.type === 'wijk');
          return [...wijken, ...unique];
        });
      } catch {
        // Street search failed silently, wijk results still shown
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, gebieden]);

  const handleSelectWijk = (gebied) => {
    setQuery(gebied.naam);
    setShowSuggestions(false);
    onSelectGebied({ code: gebied.code, naam: gebied.naam, identificatie: gebied.identificatie });
    onSelectStreet(null);
  };

  const handleSelectStreet = async (street) => {
    setQuery(street.naam);
    setShowSuggestions(false);
    setLoading(true);
    try {
      // Fetch street geometry in WGS84
      const detail = await fetchStreetGeometry(street.identificatie);
      const geom = detail.geometrie;
      if (!geom) return;

      // Compute centroid from geometry coordinates
      const coords = extractCoords(geom);
      if (coords.length === 0) return;
      const centroid = coords.reduce(
        (acc, [lon, lat]) => [acc[0] + lat / coords.length, acc[1] + lon / coords.length],
        [0, 0]
      );

      // Find which wijk this street is in
      const wijk = await findWijkByCoord(centroid[0], centroid[1]);

      // Notify parent: select the wijk and pass street geometry for highlighting
      if (wijk) {
        onSelectGebied({ code: wijk.code, naam: wijk.naam, identificatie: wijk.identificatie });
      }
      onSelectStreet({ naam: street.naam, geometry: geom, centroid });
    } catch (e) {
      console.error('Straat zoeken mislukt:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Zoek wijk of straat..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        {loading && <span className="search-loading">Laden...</span>}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s) =>
              s.type === 'wijk' ? (
                <li key={`wijk-${s.code}`} onClick={() => handleSelectWijk(s)}>
                  <span className="suggestion-name">{s.naam}</span>
                  <span className="suggestion-code">wijk · {s.code}</span>
                </li>
              ) : (
                <li key={`straat-${s.identificatie}`} onClick={() => handleSelectStreet(s)}>
                  <span className="suggestion-name">{s.naam}</span>
                  <span className="suggestion-code">straat</span>
                </li>
              )
            )}
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

// Flatten any GeoJSON geometry to a flat array of [lon, lat] pairs
function extractCoords(geom) {
  if (!geom || !geom.coordinates) return [];
  const type = geom.type;
  if (type === 'Point') return [geom.coordinates];
  if (type === 'MultiPoint' || type === 'LineString') return geom.coordinates;
  if (type === 'MultiLineString' || type === 'Polygon') return geom.coordinates.flat();
  if (type === 'MultiPolygon') return geom.coordinates.flat(2);
  return [];
}
