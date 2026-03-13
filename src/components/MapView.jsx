import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { useRef, useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';

// Buurtfocus color scale (6 steps)
export function getColor(value, higherIsWorse) {
  if (value == null) return '#ccc';
  const v = higherIsWorse ? value : 1 - value;
  if (v < 0.15) return '#1a7a2f';   // dark green - ruim boven gemiddeld
  if (v < 0.35) return '#7cba3f';   // light green - boven gemiddeld
  if (v < 0.55) return '#f0dc32';   // yellow - rond gemiddeld
  if (v < 0.75) return '#f0961e';   // orange - onder gemiddeld
  if (v < 0.9) return '#e6321e';    // red - ruim onder gemiddeld
  return '#8b1a1a';                 // dark red - veel lager
}

export function normalizeValues(kerncijfers, indicatorId) {
  if (!kerncijfers) return {};
  const values = kerncijfers[indicatorId] || {};
  const nums = Object.values(values).filter((v) => v != null);
  if (nums.length === 0) return {};
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const result = {};
  for (const [code, val] of Object.entries(values)) {
    result[code] = (val - min) / range;
  }
  return result;
}

function FlyToArea({ geojson, selectedGebied }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedGebied || !geojson) return;
    const feature = geojson.features.find(
      (f) => f.properties.code === selectedGebied.code
    );
    if (feature) {
      const L = window.L || require('leaflet');
      const layer = L.geoJSON(feature);
      map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 14 });
    }
  }, [selectedGebied?.code]);

  return null;
}

export default function MapView({ geojson, kerncijfers, selectedIndicator, selectedGebied, onSelectGebied }) {
  const geoJsonRef = useRef();

  const normalized = useMemo(() => {
    if (!kerncijfers || !selectedIndicator) return {};
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
      fillOpacity: isSelected ? 0.9 : 0.75,
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
      <FlyToArea geojson={geojson} selectedGebied={selectedGebied} />
    </MapContainer>
  );
}
