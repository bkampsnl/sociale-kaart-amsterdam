import { useState, useRef, useEffect } from 'react';
import { INDICATORS, INDICATOR_GROUPS, searchStreets, searchAddresses, parseAddressQuery, fetchStreetGeometry, findWijkByCoord } from '../api';

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

    const { street, number } = parseAddressQuery(query);

    // Local wijk + stadsdeel matches (instant) - only if no house number
    const q = query.toLowerCase();
    if (number) {
      setSuggestions([]);
    } else {
      // Stadsdeel matches
      const stadsdeelNamen = [...new Set(gebieden.map((g) => g._links?.ligtInStadsdeel?.title).filter(Boolean))];
      const stadsdeelMatches = stadsdeelNamen
        .filter((s) => s.toLowerCase().includes(q))
        .map((s) => ({ naam: s, type: 'stadsdeel' }));

      // Wijk matches
      const wijkMatches = gebieden
        .filter((g) => g.naam.toLowerCase().includes(q) || g.code.toLowerCase().includes(q))
        .slice(0, 5)
        .map((g) => ({ ...g, type: 'wijk' }));

      setSuggestions([...stadsdeelMatches, ...wijkMatches]);
    }

    // Debounced API search
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        if (number && street.length >= 2) {
          // Address search (street + house number)
          const addresses = await searchAddresses(street, number);
          if (addresses.length > 0) {
            setSuggestions((prev) => {
              const wijken = prev.filter((s) => s.type === 'wijk');
              return [...wijken, ...addresses.slice(0, 8)];
            });
          } else {
            // No address found, fall back to street search
            const streets = await searchStreets(street);
            setSuggestions((prev) => {
              const existing = prev.filter((s) => s.type === 'wijk' || s.type === 'stadsdeel');
              return [...existing, ...streets];
            });
          }
        } else {
          // Street-only search
          const streets = await searchStreets(query);
          setSuggestions((prev) => {
            const existing = prev.filter((s) => s.type === 'wijk' || s.type === 'stadsdeel');
            const seen = new Set(existing.map((w) => w.naam.toLowerCase()));
            const unique = streets.filter((s) => {
              const key = s.naam.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            return [...existing, ...unique];
          });
        }
      } catch {
        // API search failed silently
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, gebieden]);

  const handleSelectStadsdeel = (naam) => {
    setQuery(naam);
    setShowSuggestions(false);
    onSelectGebied({ stadsdeel: naam });
    onSelectStreet(null);
  };

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
      const detail = await fetchStreetGeometry(street.identificatie);
      const geom = detail.geometrie;
      if (!geom) return;

      const coords = extractCoords(geom);
      if (coords.length === 0) return;
      const centroid = coords.reduce(
        (acc, [lon, lat]) => [acc[0] + lat / coords.length, acc[1] + lon / coords.length],
        [0, 0]
      );

      const wijk = await findWijkByCoord(centroid[0], centroid[1]);
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

  const handleSelectAddress = async (address) => {
    setQuery(address.naam);
    setShowSuggestions(false);
    setLoading(true);
    try {
      const [lon, lat] = address.geometry.coordinates;

      const wijk = await findWijkByCoord(lat, lon);
      if (wijk) {
        onSelectGebied({ code: wijk.code, naam: wijk.naam, identificatie: wijk.identificatie });
      }
      onSelectStreet({
        naam: address.naam,
        geometry: address.geometry,
        centroid: [lat, lon],
        isPoint: true,
      });
    } catch (e) {
      console.error('Adres zoeken mislukt:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Zoek wijk, straat of adres..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !query.trim()) {
              onSelectGebied(null);
              onSelectStreet(null);
              setShowSuggestions(false);
            }
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        {loading && <span className="search-loading">Laden...</span>}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s, i) => {
              if (s.type === 'stadsdeel') {
                return (
                  <li key={`sd-${s.naam}`} onClick={() => handleSelectStadsdeel(s.naam)}>
                    <span className="suggestion-name">{s.naam}</span>
                    <span className="suggestion-code">stadsdeel</span>
                  </li>
                );
              }
              if (s.type === 'wijk') {
                return (
                  <li key={`wijk-${s.code}`} onClick={() => handleSelectWijk(s)}>
                    <span className="suggestion-name">{s.naam}</span>
                    <span className="suggestion-code">wijk · {s.code}</span>
                  </li>
                );
              }
              if (s.type === 'adres') {
                return (
                  <li key={`adres-${i}`} onClick={() => handleSelectAddress(s)}>
                    <span className="suggestion-name">{s.naam}</span>
                    <span className="suggestion-code">adres · {s.postcode}</span>
                  </li>
                );
              }
              return (
                <li key={`straat-${s.identificatie}`} onClick={() => handleSelectStreet(s)}>
                  <span className="suggestion-name">{s.naam}</span>
                  <span className="suggestion-code">straat</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <select
        value={selectedIndicator?.id || '_draagkracht'}
        onChange={(e) => {
          if (e.target.value === '_draagkracht') {
            onSelectIndicator({ id: '_draagkracht', label: 'Draagkracht-score', higherIsWorse: false, scale: 'draagkracht' });
          } else {
            const ind = INDICATORS.find((i) => i.id === e.target.value);
            onSelectIndicator(ind);
          }
        }}
      >
        <option value="_draagkracht">Draagkracht-score (samenvatting)</option>
        {INDICATOR_GROUPS.map((group) => (
          <optgroup key={group.key} label={group.label}>
            {INDICATORS.filter((ind) => ind.group === group.key).map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function extractCoords(geom) {
  if (!geom || !geom.coordinates) return [];
  const type = geom.type;
  if (type === 'Point') return [geom.coordinates];
  if (type === 'MultiPoint' || type === 'LineString') return geom.coordinates;
  if (type === 'MultiLineString' || type === 'Polygon') return geom.coordinates.flat();
  if (type === 'MultiPolygon') return geom.coordinates.flat(2);
  return [];
}
