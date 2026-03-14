import { useState } from 'react';
import { INDICATORS, INDICATOR_GROUPS, parseAddressQuery, searchAddresses, searchStreets, fetchStreetGeometry, findWijkByCoord } from '../api';
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
    // Convert to goodness: 0 = bad, 1 = good
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

export default function AdviesPanel({ kerncijfers, onSelectGebied, onSelectStreet }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!query || query.length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { street, number } = parseAddressQuery(query);
      let lat, lon, adresNaam;

      if (number && street.length >= 2) {
        const addresses = await searchAddresses(street, number);
        if (addresses.length > 0) {
          const addr = addresses[0];
          [lon, lat] = addr.geometry.coordinates;
          adresNaam = addr.naam;
        }
      }

      if (!lat) {
        // Try street search
        const streets = await searchStreets(street || query);
        if (streets.length > 0) {
          const detail = await fetchStreetGeometry(streets[0].identificatie);
          if (detail.geometrie) {
            const coords = flatCoords(detail.geometrie);
            if (coords.length > 0) {
              const centroid = coords.reduce(
                (acc, [lo, la]) => [acc[0] + la / coords.length, acc[1] + lo / coords.length],
                [0, 0]
              );
              lat = centroid[0];
              lon = centroid[1];
              adresNaam = streets[0].naam;
            }
          }
        }
      }

      if (!lat || !lon) {
        setError('Adres niet gevonden. Probeer een ander adres.');
        return;
      }

      const wijk = await findWijkByCoord(lat, lon);
      if (!wijk) {
        setError('Geen wijk gevonden op deze locatie.');
        return;
      }

      // Calculate scores
      const draagkracht = computeDraagkracht(kerncijfers);
      const totalScore = draagkracht[wijk.code];

      const groupScores = {};
      for (const group of INDICATOR_GROUPS) {
        groupScores[group.key] = groupScore(kerncijfers, group.key, wijk.code);
      }

      // Find nearby opvang
      const nearby = ALL_CUSTOM_LOCATIES
        .map((loc) => ({
          ...loc,
          dist: haversineKm(lat, lon, loc.lat, loc.lon),
        }))
        .filter((loc) => loc.dist < 3)
        .sort((a, b) => a.dist - b.dist);

      const totalCap = nearby.reduce((sum, loc) => sum + loc.capaciteit, 0);

      // Get indicator details for this wijk
      const indicatorDetails = {};
      for (const ind of INDICATORS) {
        const val = kerncijfers[ind.id]?.[wijk.code];
        if (val != null) {
          indicatorDetails[ind.id] = { value: val, label: ind.interpret(val) };
        }
      }

      setResult({
        adres: adresNaam,
        wijk,
        lat,
        lon,
        totalScore,
        groupScores,
        nearby,
        totalCap,
        indicatorDetails,
        advies: generateAdvies(totalScore, groupScores),
      });

      // Also navigate the map
      onSelectGebied({ code: wijk.code, naam: wijk.naam, identificatie: wijk.identificatie });
      onSelectStreet({
        naam: adresNaam,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        centroid: [lat, lon],
        isPoint: true,
      });
    } catch (e) {
      setError('Fout bij zoeken: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button className="advies-open-btn" onClick={() => setOpen(true)}>
        Locatie-advies
      </button>
    );
  }

  return (
    <div className="advies-panel">
      <div className="advies-header">
        <h3>Locatie-advies opvanglocatie</h3>
        <button className="advies-close" onClick={() => { setOpen(false); setResult(null); }}>×</button>
      </div>
      <p className="advies-desc">
        Voer een adres in om te beoordelen of de wijk geschikt is voor een nieuwe opvanglocatie.
      </p>
      <div className="advies-search">
        <input
          type="text"
          placeholder="Adres invoeren, bv. Sloterweg 100"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Analyseren...' : 'Analyseer'}
        </button>
      </div>

      {error && <div className="advies-error">{error}</div>}

      {result && (
        <div className="advies-result">
          <div className="advies-location">
            <strong>{result.adres}</strong>
            <span>Wijk: {result.wijk.naam}</span>
          </div>

          <div className="advies-total">
            <div className="advies-total-score">
              <span className="advies-score-number">{result.totalScore != null ? Math.round(result.totalScore * 100) : '?'}</span>
              <span className="advies-score-label">/100</span>
            </div>
            <div className="advies-total-info">
              <span
                className="advies-level"
                style={{ color: result.totalScore != null ? getAdviesLevel(result.totalScore).color : '#888' }}
              >
                {result.totalScore != null ? getAdviesLevel(result.totalScore).label : 'Onbekend'}
              </span>
              <span className="advies-level-text">Draagkracht</span>
            </div>
          </div>

          <div className="advies-text">{result.advies}</div>

          <div className="advies-groups">
            {INDICATOR_GROUPS.map((group) => {
              const score = result.groupScores[group.key];
              const level = score != null ? getAdviesLevel(score) : null;
              const groupInds = INDICATORS.filter((ind) => ind.group === group.key);
              return (
                <div key={group.key} className="advies-group">
                  <div className="advies-group-header">
                    <span>{level?.emoji || '⚪'} {group.label}</span>
                    <span className="advies-group-score" style={{ color: level?.color || '#888' }}>
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
              <h4>Bestaande opvang binnen 3 km</h4>
              {result.nearby.map((loc, i) => (
                <div key={i} className="advies-nearby-item">
                  <span className="advies-nearby-name">{loc.naam}</span>
                  <span className="advies-nearby-info">
                    {loc.capaciteit} plekken · {loc.dist.toFixed(1)} km
                  </span>
                </div>
              ))}
              <div className="advies-nearby-total">
                Totaal: <strong>{result.totalCap} plekken</strong> binnen 3 km
              </div>
            </div>
          )}
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

function flatCoords(geom) {
  if (!geom || !geom.coordinates) return [];
  const type = geom.type;
  if (type === 'Point') return [geom.coordinates];
  if (type === 'MultiPoint' || type === 'LineString') return geom.coordinates;
  if (type === 'MultiLineString' || type === 'Polygon') return geom.coordinates.flat();
  if (type === 'MultiPolygon') return geom.coordinates.flat(2);
  return [];
}
