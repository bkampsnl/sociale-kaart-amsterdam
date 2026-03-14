import { INDICATORS } from '../api';
import { getColor, normalizeValues } from './MapView';

export default function ScorePanel({ kerncijfers, selectedGebied }) {
  if (!selectedGebied || !kerncijfers || (selectedGebied.stadsdeel && !selectedGebied.code)) return null;

  return (
    <div className="score-panel">
      <h3 className="score-panel-title">
        Scores: {selectedGebied.naam}
      </h3>
      <div className="score-grid">
        {INDICATORS.map((ind) => {
          const val = kerncijfers[ind.id]?.[selectedGebied.code];
          if (val == null) return null;
          const label = ind.interpret(val);
          const isGood = ind.higherIsWorse
            ? ['Laag', 'Weinig'].includes(label)
            : ['Goed', 'Voldoende', 'Sterk'].includes(label);
          const isBad = ind.higherIsWorse
            ? ['Hoog', 'Zeer hoog', 'Veel', 'Zeer veel'].includes(label)
            : ['Onvoldoende', 'Zwak'].includes(label);

          return (
            <div key={ind.id} className="score-card">
              <div className="score-card-header">
                <span className="score-card-label">{shortLabel(ind.label)}</span>
                <span className={`score-badge ${isBad ? 'badge-bad' : isGood ? 'badge-good' : 'badge-mid'}`}>
                  {label}
                </span>
              </div>
              <div className="score-card-value">
                {formatVal(val, ind)}
              </div>
              <div className="score-card-bar">
                <div
                  className="score-card-fill"
                  style={{
                    width: `${barWidth(val, ind)}%`,
                    backgroundColor: barColor(val, ind),
                  }}
                />
              </div>
              <div className="score-card-desc">{ind.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function shortLabel(label) {
  return label
    .replace(' (1-10)', '')
    .replace(' (%)', '')
    .replace(': % veel', '')
    .replace('per 1.000 inwoners', '/1k');
}

function formatVal(val, ind) {
  if (ind.scale === '1-10' || ind.id.endsWith('_R')) return val.toFixed(1);
  if (ind.scale === 'percentage' || ind.id.endsWith('_P')) return `${val.toFixed(1)}%`;
  if (ind.scale === 'index' || ind.id.endsWith('_I')) return Math.round(val).toString();
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}

function barWidth(val, ind) {
  if (ind.scale === '1-10') return (val / 10) * 100;
  if (ind.scale === 'percentage') return Math.min(val, 100);
  if (ind.scale === 'index') return Math.min((val / 150) * 100, 100);
  // For count (misdrijven): cap at 150 for visual purposes
  return Math.min((val / 150) * 100, 100);
}

function barColor(val, ind) {
  const w = barWidth(val, ind);
  if (ind.higherIsWorse) {
    if (w < 25) return '#1a7a2f';
    if (w < 45) return '#7cba3f';
    if (w < 60) return '#f0dc32';
    if (w < 75) return '#f0961e';
    return '#e6321e';
  }
  // Higher is better (rapportcijfers)
  if (w >= 75) return '#1a7a2f';
  if (w >= 60) return '#7cba3f';
  if (w >= 45) return '#f0dc32';
  if (w >= 30) return '#f0961e';
  return '#e6321e';
}
