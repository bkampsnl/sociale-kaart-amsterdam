import { useState, useEffect, useMemo } from 'react';
import { fetchOpvanglocaties } from '../api';

const SOORT_COLORS = {
  '24uurs opvang': '#1a7a2f',
  'Nachtopvang': '#1a3a6e',
  'Noodopvang': '#e6321e',
  'Passantenpension': '#f0961e',
  'Inloophuis': '#7c3aed',
  'Winterkoude opvang': '#0ea5e9',
};

const SOORT_ORDER = [
  '24uurs opvang',
  'Nachtopvang',
  'Noodopvang',
  'Passantenpension',
  'Inloophuis',
  'Winterkoude opvang',
];

export function getOpvangColor(soort) {
  return SOORT_COLORS[soort] || '#888';
}

export default function OpvangFilter({ onLocatiesChange }) {
  const [locaties, setLocaties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeSoorten, setActiveSoorten] = useState(new Set());
  const [expanded, setExpanded] = useState(false);

  // Group locations by soort
  const soortCounts = useMemo(() => {
    const counts = {};
    for (const loc of locaties) {
      const soort = loc.soort && loc.soort !== '[LEEG]' ? loc.soort : 'Overig';
      counts[soort] = (counts[soort] || 0) + 1;
    }
    return counts;
  }, [locaties]);

  const sortedSoorten = useMemo(() => {
    const known = SOORT_ORDER.filter((s) => soortCounts[s]);
    const rest = Object.keys(soortCounts)
      .filter((s) => !SOORT_ORDER.includes(s))
      .sort();
    return [...known, ...rest];
  }, [soortCounts]);

  // Load data on first expand
  useEffect(() => {
    if (!expanded || loaded) return;
    setLoading(true);
    fetchOpvanglocaties()
      .then((data) => {
        setLocaties(data);
        setLoaded(true);
      })
      .finally(() => setLoading(false));
  }, [expanded, loaded]);

  // Notify parent when filter changes
  useEffect(() => {
    if (!loaded) {
      onLocatiesChange([]);
      return;
    }
    const filtered = locaties.filter((loc) => {
      const soort = loc.soort && loc.soort !== '[LEEG]' ? loc.soort : 'Overig';
      return activeSoorten.has(soort);
    });
    onLocatiesChange(filtered);
  }, [activeSoorten, locaties, loaded]);

  const toggleSoort = (soort) => {
    setActiveSoorten((prev) => {
      const next = new Set(prev);
      if (next.has(soort)) next.delete(soort);
      else next.add(soort);
      return next;
    });
  };

  const toggleAll = () => {
    if (activeSoorten.size === sortedSoorten.length) {
      setActiveSoorten(new Set());
    } else {
      setActiveSoorten(new Set(sortedSoorten));
    }
  };

  return (
    <div className="opvang-filter">
      <button
        className="opvang-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="opvang-toggle-icon">{expanded ? '▾' : '▸'}</span>
        Opvanglocaties
        {activeSoorten.size > 0 && (
          <span className="opvang-badge">{activeSoorten.size}</span>
        )}
      </button>
      {expanded && (
        <div className="opvang-panel">
          {loading ? (
            <div className="opvang-loading">Locaties laden...</div>
          ) : (
            <>
              <button className="opvang-select-all" onClick={toggleAll}>
                {activeSoorten.size === sortedSoorten.length ? 'Alles uit' : 'Alles aan'}
              </button>
              <div className="opvang-list">
                {sortedSoorten.map((soort) => (
                  <label key={soort} className="opvang-item">
                    <input
                      type="checkbox"
                      checked={activeSoorten.has(soort)}
                      onChange={() => toggleSoort(soort)}
                    />
                    <span
                      className="opvang-dot"
                      style={{ backgroundColor: getOpvangColor(soort) }}
                    />
                    <span className="opvang-soort-label">{soort}</span>
                    <span className="opvang-count">{soortCounts[soort]}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
