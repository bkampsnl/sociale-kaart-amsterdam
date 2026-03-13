import { useMemo } from 'react';
import { INDICATORS } from '../api';
import { getColor, normalizeValues } from './MapView';

export default function DataTable({ gebieden, kerncijfers, selectedGebied, onSelectGebied }) {
  // Compute normalized values for all indicators
  const normalizedMap = useMemo(() => {
    if (!kerncijfers) return {};
    const map = {};
    for (const ind of INDICATORS) {
      map[ind.id] = normalizeValues(kerncijfers, ind.id);
    }
    return map;
  }, [kerncijfers]);

  // Sort gebieden by first indicator (worst first for higherIsWorse)
  const sorted = useMemo(() => {
    if (!gebieden.length || !kerncijfers) return [];
    return [...gebieden]
      .filter((g) => !g.eindGeldigheid)
      .sort((a, b) => {
        const indId = INDICATORS[0].id;
        const aVal = kerncijfers[indId]?.[a.code];
        const bVal = kerncijfers[indId]?.[b.code];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return INDICATORS[0].higherIsWorse ? bVal - aVal : aVal - bVal;
      });
  }, [gebieden, kerncijfers]);

  if (!kerncijfers || sorted.length === 0) return null;

  return (
    <div className="data-table-container">
      <h3>Overzicht alle wijken</h3>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-wijk">Wijk</th>
              {INDICATORS.map((ind) => (
                <th key={ind.id} title={ind.label}>
                  {ind.label.replace(/:.*/,'').replace('Veiligheid buurt','Veiligheid').replace('Sociale cohesie','Soc. cohesie').replace('Kwetsbaarheidsscore hoog','Kwetsbaar').replace('Misdrijven per 1.000 inwoners','Misdrijven/1k').replace('Criminaliteit','Crimi')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => {
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
                    const bg = getColor(norm, ind.higherIsWorse);
                    const textColor = isLightColor(bg) ? '#1a1a1a' : '#ffffff';
                    return (
                      <td
                        key={ind.id}
                        style={{ backgroundColor: bg, color: textColor }}
                        className="td-value"
                      >
                        {val != null ? formatVal(val, ind) : '—'}
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
        <span className="legend-label">Legenda:</span>
        <span className="legend-swatch" style={{ background: '#1a7a2f' }}></span> Ruim boven gem.
        <span className="legend-swatch" style={{ background: '#7cba3f' }}></span> Boven gem.
        <span className="legend-swatch" style={{ background: '#f0dc32' }}></span> Gemiddeld
        <span className="legend-swatch" style={{ background: '#f0961e' }}></span> Onder gem.
        <span className="legend-swatch" style={{ background: '#e6321e' }}></span> Ruim onder gem.
        <span className="legend-swatch" style={{ background: '#8b1a1a' }}></span> Kritiek
      </div>
    </div>
  );
}

function formatVal(val, ind) {
  if (ind.id.endsWith('_R')) return val.toFixed(1);
  if (ind.id.endsWith('_P')) return `${val.toFixed(1)}%`;
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
