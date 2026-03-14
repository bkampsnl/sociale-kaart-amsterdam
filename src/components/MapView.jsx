import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { useRef, useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import { getOpvangColor } from './OpvangFilter';
import { INDICATORS } from '../api';

// Buurtfocus color scale (6 steps)
export function getColor(value, higherIsWorse) {
  if (value == null) return '#ccc';
  const v = higherIsWorse ? value : 1 - value;
  if (v < 0.15) return '#1a7a2f';
  if (v < 0.35) return '#7cba3f';
  if (v < 0.55) return '#f0dc32';
  if (v < 0.75) return '#f0961e';
  if (v < 0.9) return '#e6321e';
  return '#8b1a1a';
}

export function normalizeValues(kerncijfers, indicatorId) {
  if (!kerncijfers) return {};
  const values = kerncijfers[indicatorId] || {};
  const entries = Object.entries(values).filter(([, v]) => v != null);
  if (entries.length === 0) return {};
  // Percentile-based normalization: rank each value among all values
  const sorted = entries.map(([, v]) => v).sort((a, b) => a - b);
  const result = {};
  for (const [code, val] of entries) {
    const rank = sorted.filter((v) => v < val).length;
    result[code] = rank / (sorted.length - 1 || 1);
  }
  return result;
}

// Draagkracht-score: 0 = zwak (rood), 1 = sterk (groen)
// Combines all indicators into a single score per wijk
export function computeDraagkracht(kerncijfers) {
  if (!kerncijfers) return {};
  // Normalize each indicator
  const allNormalized = {};
  for (const ind of INDICATORS) {
    allNormalized[ind.id] = normalizeValues(kerncijfers, ind.id);
  }
  // Collect all wijk codes
  const codes = new Set();
  for (const ind of INDICATORS) {
    for (const code of Object.keys(allNormalized[ind.id])) {
      codes.add(code);
    }
  }
  // For each wijk, average all normalized values
  // higherIsWorse indicators: high normalized = bad → invert for draagkracht
  const result = {};
  for (const code of codes) {
    let sum = 0;
    let count = 0;
    for (const ind of INDICATORS) {
      const val = allNormalized[ind.id][code];
      if (val == null) continue;
      // Convert to "goodness": 0 = bad, 1 = good
      sum += ind.higherIsWorse ? (1 - val) : val;
      count++;
    }
    if (count > 0) {
      result[code] = sum / count;
    }
  }
  return result;
}

function FlyToArea({ geojson, selectedGebied, selectedStreet }) {
  const map = useMap();

  useEffect(() => {
    if (selectedStreet?.geometry) {
      if (selectedStreet.isPoint) {
        map.flyTo(selectedStreet.centroid, 17, { duration: 1.5 });
      } else {
        const layer = L.geoJSON(selectedStreet.geometry);
        map.flyToBounds(layer.getBounds(), { padding: [80, 80], maxZoom: 15 });
      }
      return;
    }
    if (!selectedGebied && !selectedStreet) {
      map.flyTo([52.37, 4.895], 12, { duration: 1 });
      return;
    }
    if (!selectedGebied || !geojson) return;

    // Stadsdeel selected (no code = pure stadsdeel selection from search)
    if (selectedGebied.stadsdeel && !selectedGebied.code) {
      const features = geojson.features.filter(
        (f) => f.properties.stadsdeel === selectedGebied.stadsdeel
      );
      if (features.length > 0) {
        const group = L.geoJSON({ type: 'FeatureCollection', features });
        map.flyToBounds(group.getBounds(), { padding: [60, 60], maxZoom: 13 });
      }
      return;
    }

    const feature = geojson.features.find(
      (f) => f.properties.code === selectedGebied.code
    );
    if (feature) {
      const layer = L.geoJSON(feature);
      map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
  }, [selectedGebied, selectedStreet, geojson, map]);

  return null;
}

function StreetHighlight({ selectedStreet }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    // Remove previous layers
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!selectedStreet?.geometry) return;

    let layer;
    if (selectedStreet.isPoint) {
      // Address: show a large circle marker
      const [lat, lon] = selectedStreet.centroid;
      layer = L.layerGroup([
        L.circleMarker([lat, lon], {
          radius: 12,
          color: '#ff00ff',
          weight: 3,
          fillColor: '#ff00ff',
          fillOpacity: 0.4,
        }),
        L.circleMarker([lat, lon], {
          radius: 4,
          color: '#fff',
          weight: 2,
          fillColor: '#ff00ff',
          fillOpacity: 1,
        }),
      ]);
    } else {
      // Street: show polygon/line highlight
      layer = L.geoJSON(selectedStreet.geometry, {
        style: {
          color: '#ff00ff',
          weight: 5,
          opacity: 0.9,
          fillColor: '#ff00ff',
          fillOpacity: 0.3,
        },
      });
    }
    layer.addTo(map);
    layerRef.current = layer;

    // Add a label popup
    if (selectedStreet.centroid) {
      const popup = L.popup({ closeButton: false, autoClose: false, closeOnClick: false, className: 'street-popup' })
        .setLatLng(selectedStreet.centroid)
        .setContent(`<strong>${selectedStreet.naam}</strong>`)
        .openOn(map);
      layer._streetPopup = popup;
    }

    return () => {
      if (layerRef.current) {
        if (layerRef.current._streetPopup) {
          map.closePopup(layerRef.current._streetPopup);
        }
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [selectedStreet, map]);

  return null;
}

function OpvangMarkers({ locaties }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!locaties || locaties.length === 0) return;

    const group = L.layerGroup();
    for (const loc of locaties) {
      if (!loc.geometry?.coordinates) continue;
      const [lon, lat] = loc.geometry.coordinates;
      const soort = loc.soort && loc.soort !== '[LEEG]' ? loc.soort : 'Overig';
      const color = getOpvangColor(soort);
      const marker = L.circleMarker([lat, lon], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
      });
      const adres = `${loc.straat || ''} ${loc.huisnummer || ''}`.trim();
      marker.bindPopup(
        `<strong>${loc.naam}</strong><br/>` +
        `<em>${soort}</em><br/>` +
        `${adres}${loc.postcode ? ', ' + loc.postcode : ''}<br/>` +
        `${loc.stadsdeel || ''}`
      );
      marker.bindTooltip(loc.naam, { direction: 'top', offset: [0, -8] });
      group.addLayer(marker);
    }
    group.addTo(map);
    layerRef.current = group;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [locaties, map]);

  return null;
}

function AsielMarkers({ locaties }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!locaties || locaties.length === 0) return;

    const group = L.layerGroup();
    for (const loc of locaties) {
      const color = getOpvangColor(loc.soort);
      const marker = L.circleMarker([loc.lat, loc.lon], {
        radius: 9,
        fillColor: color,
        color: '#fff',
        weight: 3,
        fillOpacity: 0.9,
      });
      let popupHtml =
        `<strong>${loc.naam}</strong><br/>` +
        `${loc.adres}<br/>` +
        `<em>${loc.soort}</em><br/>` +
        `Doelgroep: ${loc.doelgroep}<br/>` +
        `Capaciteit: <strong>${loc.capaciteit}</strong> plekken`;
      if (loc.extra) popupHtml += `<br/>${loc.extra}`;
      marker.bindPopup(popupHtml);
      marker.bindTooltip(`${loc.naam} (${loc.capaciteit})`, { direction: 'top', offset: [0, -10] });
      group.addLayer(marker);
    }
    group.addTo(map);
    layerRef.current = group;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [locaties, map]);

  return null;
}

const FOCUS_STADSDEEL = 'Nieuw-West';

function StadsdeelHighlight({ geojson }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!geojson) return;

    const features = geojson.features.filter(
      (f) => f.properties.stadsdeel === FOCUS_STADSDEEL
    );
    if (features.length === 0) return;

    const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: {
        fill: false,
        color: '#1a3a6e',
        weight: 4,
        opacity: 0.8,
        dashArray: null,
      },
      interactive: false,
    });
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [geojson, map]);

  return null;
}

export default function MapView({ geojson, kerncijfers, selectedIndicator, selectedGebied, selectedStreet, onSelectGebied, opvangLocaties, asielLocaties }) {
  const geoJsonRef = useRef();

  const normalized = useMemo(() => {
    if (!kerncijfers || !selectedIndicator) return {};
    if (selectedIndicator.id === '_draagkracht') {
      return computeDraagkracht(kerncijfers);
    }
    return normalizeValues(kerncijfers, selectedIndicator.id);
  }, [kerncijfers, selectedIndicator]);

  const style = (feature) => {
    const code = feature.properties.code;
    const value = normalized[code];
    const isSelected = selectedGebied?.code === code;
    return {
      fillColor: getColor(value, selectedIndicator?.higherIsWorse),
      weight: isSelected ? 3 : 1,
      color: isSelected ? '#1a3a6e' : '#888',
      fillOpacity: isSelected ? 0.7 : 0.5,
    };
  };

  const onEachFeature = (feature, layer) => {
    layer.on('click', () => {
      onSelectGebied(feature.properties);
    });
    layer.bindTooltip(feature.properties.naam, { sticky: true });
  };

  useEffect(() => {
    if (geoJsonRef.current) {
      geoJsonRef.current.setStyle(style);
    }
  }, [normalized, selectedGebied]);

  if (!geojson) return <div className="map-loading">Kaart laden...</div>;

  return (
    <MapContainer
      center={[52.37, 4.895]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <GeoJSON
        key={selectedIndicator?.id || 'default'}
        ref={geoJsonRef}
        data={geojson}
        style={style}
        onEachFeature={onEachFeature}
      />
      <StadsdeelHighlight geojson={geojson} />
      <FlyToArea geojson={geojson} selectedGebied={selectedGebied} selectedStreet={selectedStreet} />
      <StreetHighlight selectedStreet={selectedStreet} />
      <OpvangMarkers locaties={opvangLocaties} />
      <AsielMarkers locaties={asielLocaties} />
    </MapContainer>
  );
}
