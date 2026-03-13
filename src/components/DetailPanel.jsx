import { useState, useEffect, useMemo } from 'react';
import { INDICATORS, fetchMeldingenByCategorie } from '../api';

// Compute where a value falls relative to all areas (0 = best, 1 = worst)
function normalize(val, allValues, higherIsWorse) {
  if (val == null || allValues.length === 0) return null;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (max === min) return 0.5;
  const n = (val - min) / (max - min);
  return higherIsWorse ? n : 1 - n;
}

function getSeverityColor(n) {
  if (n == null) return '#666';
  if (n < 0.25) return '#2d8a4e';
  if (n < 0.5) return '#a3be4c';
  if (n < 0.75) return '#f0a030';
  return '#d32f2f';
}

function getSeverityLabel(n) {
  if (n == null) return '';
  if (n < 0.25) return 'Goed';
  if (n < 0.5) return 'Gemiddeld';
  if (n < 0.75) return 'Aandacht';
  return 'Zorgelijk';
}

function getPercentileLabel(val, allValues, higherIsWorse) {
  if (val == null || allValues.length === 0) return '';
  const sorted = [...allValues].sort((a, b) => a - b);
  const idx = sorted.findIndex((v) => v >= val);
  const pct = Math.round((idx / (sorted.length - 1)) * 100);
  if (higherIsWorse) {
    return `Hoger dan ${pct}% van de wijken`;
  }
  return `Lager dan ${100 - pct}% van de wijken`;
}

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

  // Pre-compute all values per indicator for relative comparison
  const allValuesMap = useMemo(() => {
    if (!kerncijfers) return {};
    const map = {};
    for (const ind of INDICATORS) {
      const vals = kerncijfers[ind.id] || {};
      map[ind.id] = Object.values(vals).filter((v) => v != null);
    }
    return map;
  }, [kerncijfers]);

  if (!gebied) {
    return (
      <div className="detail-panel empty">
        <h2>Amsterdam Wijkveiligheid</h2>
        <p>Klik op een wijk in de kaart of zoek hierboven.</p>
      </div>
    );
  }

  const maxMelding = meldingen?.[0]?.aantal || 1;

  return (
    <div className="detail-panel">
      <h2>{gebied.naam}</h2>
      <p className="gebied-code">{gebied.code}</p>

      <h3>Kerncijfers</h3>
      <div className="stats-list">
        {INDICATORS.map((ind) => {
          const val = kerncijfers?.[ind.id]?.[gebied.code];
          const allVals = allValuesMap[ind.id] || [];
          const n = normalize(val, allVals, ind.higherIsWorse);
          const color = getSeverityColor(n);
          const barWidth = n != null ? Math.max(n * 100, 4) : 0;
          const severity = getSeverityLabel(n);

          return (
            <div key={ind.id} className="stat-row">
              <div className="stat-header">
                <span className="stat-label">{ind.label}</span>
                <div className="stat-value-group">
                  <span className="stat-value" style={{ color }}>
                    {val != null ? formatValue(val, ind) : '—'}
                  </span>
                  {severity && (
                    <span className="stat-severity" style={{ color }}>
                      {severity}
                    </span>
                  )}
                </div>
              </div>
              <div className="stat-bar-bg">
                <div
                  className="stat-bar-fill"
                  style={{ width: `${barWidth}%`, background: color }}
                />
              </div>
              {val != null && (
                <span className="stat-percentile">
                  {getPercentileLabel(val, allVals, ind.higherIsWorse)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <h3>Meldingen per categorie</h3>
      {loadingMeldingen && <p className="loading">Laden...</p>}
      {meldingen && meldingen.length === 0 && (
        <p className="loading">Geen meldingen gevonden</p>
      )}
      {meldingen && meldingen.length > 0 && (
        <div className="meldingen-chart">
          {meldingen.slice(0, 12).map((m, i) => {
            const pct = (m.aantal / maxMelding) * 100;
            // Color intensity based on relative count
            const intensity = m.aantal / maxMelding;
            const barColor =
              intensity > 0.7 ? '#d32f2f' : intensity > 0.4 ? '#f0a030' : '#4fc3f7';
            return (
              <div key={i} className="meld-bar-row">
                <span className="meld-bar-label" title={m.categorie}>
                  {m.categorie}
                </span>
                <div className="meld-bar-track">
                  <div
                    className="meld-bar-fill"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <span className="meld-bar-count">{m.aantal}</span>
              </div>
            );
          })}
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
