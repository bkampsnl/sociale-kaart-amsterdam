import { useMemo } from 'react';
import { INDICATORS } from '../api';
import { getColor, normalizeValues, computeDraagkracht } from './MapView';

export default function DataTable({ gebieden, geojson, kerncijfers, selectedGebied, selectedStreet, onSelectGebied, onSelectStreet, selectedIndicator }) {
  const normalizedMap = useMemo(() => {
    if (!kerncijfers) return {};
    const map = {};
    for (const ind of INDICATORS) {
      map[ind.id] = normalizeValues(kerncijfers, ind.id);
    }
    return map;
  }, [kerncijfers]);

  // Draagkracht scores for sorting when draagkracht is selected
  const draagkracht = useMemo(() => {
    if (!kerncijfers || selectedIndicator?.id !== '_draagkracht') return null;
    return computeDraagkracht(kerncijfers);
  }, [kerncijfers, selectedIndicator]);

  // Sort by the currently selected indicator (worst first)
  const sorted = useMemo(() => {
    if (!gebieden.length || !kerncijfers || !selectedIndicator) return [];
    if (selectedIndicator.id === '_draagkracht' && draagkracht) {
      return [...gebieden]
        .filter((g) => !g.eindGeldigheid)
        .sort((a, b) => {
          const aVal = draagkracht[a.code];
          const bVal = draagkracht[b.code];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          return aVal - bVal; // lowest draagkracht first (worst)
        });
    }
    const indId = selectedIndicator.id;
    return [...gebieden]
      .filter((g) => !g.eindGeldigheid)
      .sort((a, b) => {
        const aVal = kerncijfers[indId]?.[a.code];
        const bVal = kerncijfers[indId]?.[b.code];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return selectedIndicator.higherIsWorse ? bVal - aVal : aVal - bVal;
      });
  }, [gebieden, kerncijfers, selectedIndicator, draagkracht]);

  // When a stadsdeel is selected, show wijken in that stadsdeel
  // When a wijk is selected, show only that row; otherwise show all
  const stadsdeelCodes = useMemo(() => {
    if (!selectedGebied?.stadsdeel || selectedGebied?.code || !geojson) return null;
    return new Set(
      geojson.features
        .filter((f) => f.properties.stadsdeel === selectedGebied.stadsdeel)
        .map((f) => f.properties.code)
    );
  }, [selectedGebied?.stadsdeel, geojson]);

  const isStadsdeelOnly = selectedGebied?.stadsdeel && !selectedGebied?.code;
  const displayRows = isStadsdeelOnly
    ? sorted.filter((g) => stadsdeelCodes?.has(g.code))
    : selectedGebied?.code
      ? sorted.filter((g) => g.code === selectedGebied.code)
      : sorted;

  if (!kerncijfers || sorted.length === 0) return null;

  return (
    <div className="data-table-container">
      <h3>
        {isStadsdeelOnly
          ? `Wijken in ${selectedGebied.stadsdeel} — gesorteerd op: ${selectedIndicator.label}`
          : selectedGebied?.code
            ? `Details: ${selectedGebied.naam}${selectedStreet ? ` — ${selectedStreet.naam}` : ''}`
            : `Overzicht alle wijken — gesorteerd op: ${selectedIndicator.label}`}
      </h3>
      {selectedGebied && (
        <button className="clear-selection" onClick={() => { onSelectGebied(null); onSelectStreet(null); }}>
          Toon alle wijken
        </button>
      )}
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-wijk">Wijk</th>
              {INDICATORS.map((ind) => (
                <th
                  key={ind.id}
                  title={`${ind.label}\n${ind.description}\nSchaal: ${ind.scale === '1-10' ? 'rapportcijfer 1-10 (hoger = beter)' : ind.scale === 'percentage' ? 'percentage (lager = beter)' : 'aantal per 1.000 inwoners (lager = beter)'}`}
                  className={ind.id === selectedIndicator.id ? 'th-active' : ''}
                >
                  {shortLabel(ind.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((g) => {
              const isSelected = selectedGebied?.code === g.code;
              return (
                <tr
                  key={g.code}
                  className={isSelected ? 'selected-row' : ''}
                  onClick={() => onSelectGebied({ code: g.code, naam: g.naam, identificatie: g.identificatie })}
                >
                  <td className="td-wijk">{g.naam}</td>
                  {INDICATORS.map((ind) => {
                    const val = kerncijfers[ind.id]?.[g.code];
                    const norm = normalizedMap[ind.id]?.[g.code];
                    // No data = gray background, no color coding
                    if (val == null) {
                      return (
                        <td
                          key={ind.id}
                          style={{ backgroundColor: '#eee', color: '#999' }}
                          className="td-value"
                        >
                          —
                        </td>
                      );
                    }
                    const bg = getColor(norm, ind.higherIsWorse);
                    const textColor = isLightColor(bg) ? '#1a1a1a' : '#ffffff';
                    return (
                      <td
                        key={ind.id}
                        style={{ backgroundColor: bg, color: textColor }}
                        className="td-value"
                      >
                        {formatVal(val, ind)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend-bar">
        <span className="legend-label">Legenda (t.o.v. Amsterdams gemiddelde):</span>
        <span className="legend-swatch" style={{ background: '#1a7a2f' }}></span> Ruim boven gem.
        <span className="legend-swatch" style={{ background: '#7cba3f' }}></span> Boven gem.
        <span className="legend-swatch" style={{ background: '#f0dc32' }}></span> Gemiddeld
        <span className="legend-swatch" style={{ background: '#f0961e' }}></span> Onder gem.
        <span className="legend-swatch" style={{ background: '#e6321e' }}></span> Ruim onder gem.
        <span className="legend-swatch" style={{ background: '#8b1a1a' }}></span> Kritiek
        <span className="legend-swatch" style={{ background: '#eee', border: '1px solid #ccc' }}></span> Geen data
      </div>
    </div>
  );
}

function shortLabel(label) {
  const map = {
    'Misdrijven per 1.000 inwoners': 'Misdrijven/1k',
    'Veiligheid buurt (1-10)': 'Veiligheid',
    'High Impact Crime index': 'HIC index',
    'Criminaliteit: % veel': 'Crimi %',
    'Drugsoverlast (%)': 'Drugs %',
    'Overlast: % veel': 'Overlast %',
    'Overlast: jongeren (%)': 'Jongeren %',
    'Leefbaarheid buurt (1-10)': 'Leefbaarh.',
    'Sociale cohesie (1-10)': 'Soc. cohesie',
    'Eenzaamheid (%)': 'Eenzaam %',
    'Discriminatie-ervaring (%)': 'Discrim. %',
    'Omgang tussen groepen (1-10)': 'Omgang gr.',
    'Kwetsbaarheid hoog (%)': 'Kwetsbaar %',
    'SES laag (%)': 'SES laag %',
    'Uitkeringsdruk (%)': 'Uitkering %',
    'Psychische klachten (%)': 'Psych. %',
    'Kwetsbare kinderen (%)': 'Kwetsb. kind.',
    'Woningdruk: krap wonen (%)': 'Woningdruk %',
  };
  return map[label] || label;
}

function formatVal(val, ind) {
  if (ind.scale === '1-10' || ind.id.endsWith('_R')) return val.toFixed(1);
  if (ind.scale === 'percentage' || ind.id.endsWith('_P')) return `${val.toFixed(1)}%`;
  if (ind.scale === 'index' || ind.id.endsWith('_I')) return Math.round(val).toString();
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
