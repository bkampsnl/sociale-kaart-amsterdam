import { useMemo } from 'react';
import { INDICATORS, INDICATOR_GROUPS } from '../api';
import { normalizeValues, computeDraagkracht } from './MapView';
import { ALL_CUSTOM_LOCATIES } from './OpvangFilter';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupScore(kerncijfers, groupKey, wijkCode) {
  const groupInds = INDICATORS.filter((ind) => ind.group === groupKey);
  let sum = 0;
  let count = 0;
  for (const ind of groupInds) {
    const val = kerncijfers[ind.id]?.[wijkCode];
    if (val == null) continue;
    const normalized = normalizeValues(kerncijfers, ind.id);
    const norm = normalized[wijkCode];
    if (norm == null) continue;
    sum += ind.higherIsWorse ? (1 - norm) : norm;
    count++;
  }
  return count > 0 ? sum / count : null;
}

function getAdviesLevel(score) {
  if (score >= 0.65) return { label: 'Sterk', color: '#1a7a2f', emoji: '🟢' };
  if (score >= 0.45) return { label: 'Voldoende', color: '#7cba3f', emoji: '🟡' };
  if (score >= 0.30) return { label: 'Zwak', color: '#f0961e', emoji: '🟠' };
  return { label: 'Kritiek', color: '#e6321e', emoji: '🔴' };
}

function generateAdvies(totalScore, groupScores) {
  const weakGroups = Object.entries(groupScores)
    .filter(([, s]) => s != null && s < 0.35)
    .map(([key]) => INDICATOR_GROUPS.find((g) => g.key === key)?.label)
    .filter(Boolean);

  if (totalScore >= 0.65) {
    return 'Deze wijk scoort bovengemiddeld op de meeste indicatoren. Er is ruimte voor extra opvang zonder significante risico\'s.';
  }
  if (totalScore >= 0.45) {
    let text = 'Deze wijk scoort gemiddeld. Extra opvang is mogelijk, maar vergt aandacht';
    if (weakGroups.length > 0) text += ` voor: ${weakGroups.join(', ')}`;
    return text + '.';
  }
  if (totalScore >= 0.30) {
    return `Deze wijk scoort onder gemiddeld. Extra opvang wordt afgeraden zonder aanvullende maatregelen. Zwakke punten: ${weakGroups.join(', ') || 'meerdere categorieën'}.`;
  }
  return `Deze wijk is overbelast op meerdere indicatoren. Extra opvang wordt sterk afgeraden. Kritieke categorieën: ${weakGroups.join(', ') || 'meerdere'}.`;
}

export default function AdviesPanel({ kerncijfers, selectedGebied, selectedStreet, geojson }) {
  // Only show when a specific wijk is selected (not stadsdeel-only)
  const wijkCode = selectedGebied?.code;

  const result = useMemo(() => {
    if (!wijkCode || !kerncijfers) return null;

    const draagkracht = computeDraagkracht(kerncijfers);
    const totalScore = draagkracht[wijkCode];
    if (totalScore == null) return null;

    const groupScores = {};
    for (const group of INDICATOR_GROUPS) {
      groupScores[group.key] = groupScore(kerncijfers, group.key, wijkCode);
    }

    const indicatorDetails = {};
    for (const ind of INDICATORS) {
      const val = kerncijfers[ind.id]?.[wijkCode];
      if (val != null) {
        indicatorDetails[ind.id] = { value: val, label: ind.interpret(val) };
      }
    }

    // Find centroid for nearby calculation
    let lat = null, lon = null;
    if (selectedStreet?.centroid) {
      [lat, lon] = selectedStreet.centroid;
    } else if (geojson) {
      const feature = geojson.features.find((f) => f.properties.code === wijkCode);
      if (feature) {
        // Approximate centroid from bbox
        const coords = feature.geometry.coordinates.flat(3);
        const lats = [], lons = [];
        for (let i = 0; i < coords.length; i += 2) {
          lons.push(coords[i]);
          lats.push(coords[i + 1]);
        }
        if (lats.length > 0) {
          lat = lats.reduce((a, b) => a + b) / lats.length;
          lon = lons.reduce((a, b) => a + b) / lons.length;
        }
      }
    }

    let nearby = [];
    let totalCap = 0;
    if (lat && lon) {
      nearby = ALL_CUSTOM_LOCATIES
        .map((loc) => ({ ...loc, dist: haversineKm(lat, lon, loc.lat, loc.lon) }))
        .filter((loc) => loc.dist < 3)
        .sort((a, b) => a.dist - b.dist);
      totalCap = nearby.reduce((sum, loc) => sum + loc.capaciteit, 0);
    }

    return {
      totalScore,
      groupScores,
      indicatorDetails,
      nearby,
      totalCap,
      advies: generateAdvies(totalScore, groupScores),
    };
  }, [wijkCode, kerncijfers, selectedStreet, geojson]);

  if (!result) return null;

  const level = getAdviesLevel(result.totalScore);

  return (
    <div className="advies-inline">
      <div className="advies-inline-header">
        <div className="advies-total">
          <div className="advies-total-score">
            <span className="advies-score-number">{Math.round(result.totalScore * 100)}</span>
            <span className="advies-score-label">/100</span>
          </div>
          <div className="advies-total-info">
            <span className="advies-level" style={{ color: level.color }}>{level.label}</span>
            <span className="advies-level-text">Draagkracht</span>
          </div>
        </div>
      </div>

      <div className="advies-text">{result.advies}</div>

      <div className="advies-groups">
        {INDICATOR_GROUPS.map((group) => {
          const score = result.groupScores[group.key];
          const groupLevel = score != null ? getAdviesLevel(score) : null;
          const groupInds = INDICATORS.filter((ind) => ind.group === group.key);
          return (
            <div key={group.key} className="advies-group">
              <div className="advies-group-header">
                <span>{groupLevel?.emoji || '⚪'} {group.label}</span>
                <span className="advies-group-score" style={{ color: groupLevel?.color || '#888' }}>
                  {score != null ? Math.round(score * 100) : '?'}/100
                </span>
              </div>
              <div className="advies-group-details">
                {groupInds.map((ind) => {
                  const detail = result.indicatorDetails[ind.id];
                  if (!detail) return null;
                  return (
                    <div key={ind.id} className="advies-indicator">
                      <span className="advies-ind-label">{ind.label}</span>
                      <span className="advies-ind-value">{formatVal(detail.value, ind)}</span>
                      <span className={`advies-ind-badge advies-badge-${badgeType(detail.label, ind)}`}>
                        {detail.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {result.nearby.length > 0 && (
        <div className="advies-nearby">
          <h4>Bestaande opvang in de buurt</h4>
          {result.nearby.map((loc, i) => (
            <div key={i} className="advies-nearby-item">
              <span className="advies-nearby-name">{loc.naam}</span>
              <span className="advies-nearby-info">
                {loc.capaciteit} plekken · {Math.round(loc.dist * 12)} min lopen
              </span>
            </div>
          ))}
          <div className="advies-nearby-total">
            Totaal: <strong>{result.totalCap} plekken</strong> binnen 35 min lopen
          </div>
        </div>
      )}
    </div>
  );
}

function formatVal(val, ind) {
  if (ind.scale === '1-10') return val.toFixed(1);
  if (ind.scale === 'percentage') return `${val.toFixed(1)}%`;
  if (ind.scale === 'index') return Math.round(val).toString();
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}

function badgeType(label, ind) {
  const good = ['Laag', 'Weinig', 'Goed', 'Voldoende', 'Sterk'].includes(label);
  const bad = ['Hoog', 'Zeer hoog', 'Veel', 'Zeer veel', 'Onvoldoende', 'Zwak', 'Slecht', 'Kritiek'].includes(label);
  if (ind.higherIsWorse) return good ? 'good' : bad ? 'bad' : 'mid';
  return good ? 'good' : bad ? 'bad' : 'mid';
}
