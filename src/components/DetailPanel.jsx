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
              <span className="stat-value">
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
