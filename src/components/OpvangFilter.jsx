import { useState, useEffect, useMemo } from 'react';
import { fetchOpvanglocaties } from '../api';

const SOORT_COLORS = {
  '24uurs opvang': '#1a7a2f',
  'Nachtopvang': '#1a3a6e',
  'Noodopvang': '#e6321e',
  'Passantenpension': '#f0961e',
  'Inloophuis': '#7c3aed',
  'Winterkoude opvang': '#0ea5e9',
  'COA Noodopvang': '#ff6b6b',
  'COA Regulier': '#2d9c4f',
  'Gemeentelijke opvang: OEK': '#d97706',
  'Gemeentelijke opvang: OGD': '#9333ea',
  'Gemengde huisvesting': '#0891b2',
};

const SOORT_ORDER = [
  '24uurs opvang',
  'Nachtopvang',
  'Noodopvang',
  'Passantenpension',
  'Inloophuis',
  'Winterkoude opvang',
];

const ASIEL_SOORT_ORDER = [
  'COA Noodopvang',
  'COA Regulier',
  'Gemeentelijke opvang: OEK',
  'Gemeentelijke opvang: OGD',
];

const GEMENGD_SOORT_ORDER = [
  'Gemengde huisvesting',
];

const ASIEL_LOCATIES = [
  { naam: 'Sloterweg', soort: 'COA Noodopvang', doelgroep: 'Minderjarige asielzoekers (66 jongens, 14 meiden)', adres: 'Sloterweg 773-783', capaciteit: 80, extra: '2e verlenging: 15 jan 2026 t/m 15 jan 2027', lat: 52.341672, lon: 4.818135 },
  { naam: 'Mercure hotel', soort: 'COA Noodopvang', doelgroep: 'Mannen', adres: 'Oude Haagseweg 20', capaciteit: 90, extra: 'Verlengd t/m december 2027', lat: 52.337214, lon: 4.817336 },
  { naam: 'Corendon', soort: 'COA Noodopvang', doelgroep: 'Asielzoekers: stellen, vrouwen en mannen (geen gezinnen)', adres: 'Aletta Jacobslaan 7', capaciteit: 150, extra: 'Loopt t/m augustus 2026', lat: 52.346632, lon: 4.831134 },
  { naam: 'AZC Willinklaan', soort: 'COA Regulier', doelgroep: 'Gezinnen, stellen, vrouwen en mannen', adres: 'Willinklaan 3', capaciteit: 650, extra: 'Tot oktober 2026', lat: 52.371500, lon: 4.802109 },
  { naam: 'Naritaweg', soort: 'Gemeentelijke opvang: OEK', doelgroep: 'OEK', adres: 'Naritaweg 156', capaciteit: 295, extra: 'Huurcontract 10 jaar t/m juni 2035', lat: 52.387924, lon: 4.834725 },
  { naam: 'Kings Court', soort: 'Gemeentelijke opvang: OEK', doelgroep: 'OEK', adres: 'Delflandlaan 4', capaciteit: 230, extra: 'Tot 1 april 2027', lat: 52.357033, lon: 4.840363 },
  { naam: 'Anderlechtlaan 181', soort: 'Gemeentelijke opvang: OEK', doelgroep: 'OEK', adres: 'Anderlechtlaan 181', capaciteit: 203, extra: 'Huurcontract t/m maart 2035', lat: 52.342653, lon: 4.811939 },
  { naam: 'Anderlechtlaan', soort: 'Gemeentelijke opvang: OGD', doelgroep: 'OGD', adres: 'Anderlechtlaan 3', capaciteit: 60, extra: 'Tot augustus 2028', lat: 52.343742, lon: 4.811967 },
];

const GEMENGD_LOCATIES = [
  { naam: 'Startblok Riekerhaven', soort: 'Gemengde huisvesting', doelgroep: 'Studenten en statushouders, 18-27 jaar. 40% statushouders, 60% jongeren', adres: 'Handbalstraat / Voetbalstraat / Korfbalstraat / Sportparklaan 1-740', capaciteit: 407, extra: 'Einddatum 30 september 2027. 407 woningen', lat: 52.343018, lon: 4.838967 },
  { naam: 'Riekerpark', soort: 'Gemengde huisvesting', doelgroep: 'Statushouders: alleenstaanden en stellen vanaf 28 jaar. Amsterdammers: studenten, jongeren, economische daklozen, beroepsgroepen en overig. 50% statushouders, 50% Nederlanders', adres: 'Riekerpolder', capaciteit: 216, extra: 'Flexwoningen, aangekocht voor 10 jaar. 216 woningen', lat: 52.340881, lon: 4.824912 },
  { naam: 'Karmijn', soort: 'Gemengde huisvesting', doelgroep: 'Statushouders en jongeren (50/50), 18-22 jaar', adres: 'Louwesweg 5-231', capaciteit: 110, extra: 'Verlengd huurcontract t/m 7 juli 2032', lat: 52.346395, lon: 4.824791 },
];

// Combine asiel + gemengd for the marker layer
export const ALL_CUSTOM_LOCATIES = [...ASIEL_LOCATIES, ...GEMENGD_LOCATIES];

export function getOpvangColor(soort) {
  return SOORT_COLORS[soort] || '#888';
}

export default function OpvangFilter({ onLocatiesChange, onAsielLocatiesChange }) {
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

  // Asiel counts
  const asielCounts = useMemo(() => {
    const counts = {};
    for (const loc of ASIEL_LOCATIES) {
      counts[loc.soort] = (counts[loc.soort] || 0) + 1;
    }
    return counts;
  }, []);

  // Gemengd counts
  const gemengdCounts = useMemo(() => {
    const counts = {};
    for (const loc of GEMENGD_LOCATIES) {
      counts[loc.soort] = (counts[loc.soort] || 0) + 1;
    }
    return counts;
  }, []);

  const sortedSoorten = useMemo(() => {
    const known = SOORT_ORDER.filter((s) => soortCounts[s]);
    const rest = Object.keys(soortCounts)
      .filter((s) => !SOORT_ORDER.includes(s))
      .sort();
    return [...known, ...rest];
  }, [soortCounts]);

  const allSoorten = useMemo(
    () => [...sortedSoorten, ...ASIEL_SOORT_ORDER, ...GEMENGD_SOORT_ORDER],
    [sortedSoorten]
  );

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
      onAsielLocatiesChange([]);
      return;
    }
    const filtered = locaties.filter((loc) => {
      const soort = loc.soort && loc.soort !== '[LEEG]' ? loc.soort : 'Overig';
      return activeSoorten.has(soort);
    });
    onLocatiesChange(filtered);

    const filteredCustom = ALL_CUSTOM_LOCATIES.filter((loc) => activeSoorten.has(loc.soort));
    onAsielLocatiesChange(filteredCustom);
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
    if (activeSoorten.size === allSoorten.length) {
      setActiveSoorten(new Set());
    } else {
      setActiveSoorten(new Set(allSoorten));
    }
  };

  // Calculate active asiel capacity
  const activeAsielCap = useMemo(() => {
    return ASIEL_LOCATIES
      .filter((loc) => activeSoorten.has(loc.soort))
      .reduce((sum, loc) => sum + loc.capaciteit, 0);
  }, [activeSoorten]);

  // Calculate active gemengd capacity
  const activeGemengdCap = useMemo(() => {
    return GEMENGD_LOCATIES
      .filter((loc) => activeSoorten.has(loc.soort))
      .reduce((sum, loc) => sum + loc.capaciteit, 0);
  }, [activeSoorten]);

  const activeCount = activeSoorten.size;

  return (
    <div className="opvang-filter">
      <button
        className="opvang-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="opvang-toggle-icon">{expanded ? '▾' : '▸'}</span>
        Opvanglocaties
        {activeCount > 0 && (
          <span className="opvang-badge">{activeCount}</span>
        )}
      </button>
      {expanded && (
        <div className="opvang-panel">
          {loading ? (
            <div className="opvang-loading">Locaties laden...</div>
          ) : (
            <>
              <button className="opvang-select-all" onClick={toggleAll}>
                {activeSoorten.size === allSoorten.length ? 'Alles uit' : 'Alles aan'}
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

                <div className="opvang-divider">Asielopvang</div>

                {ASIEL_SOORT_ORDER.map((soort) => (
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
                    <span className="opvang-count">{asielCounts[soort]}</span>
                  </label>
                ))}

                {activeAsielCap > 0 && (
                  <div className="opvang-cap-total">
                    Capaciteit: {activeAsielCap} plekken
                  </div>
                )}

                <div className="opvang-divider">Gemengde huisvestingslocaties</div>

                {GEMENGD_SOORT_ORDER.map((soort) => (
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
                    <span className="opvang-count">{gemengdCounts[soort]}</span>
                  </label>
                ))}

                {activeGemengdCap > 0 && (
                  <div className="opvang-cap-total">
                    Capaciteit: {activeGemengdCap} woningen
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
