import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { useRef, useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';

function getColor(value, higherIsWorse) {
  if (value == null) return '#666';
  const v = higherIsWorse ? value : 1 - value;
  if (v < 0.25) return '#2d8a4e';
  if (v < 0.5) return '#a3be4c';
  if (v < 0.75) return '#f0a030';
  return '#d32f2f';
}

export default function MapView({ geojson, kerncijfers, selectedIndicator, selectedGebied, onSelectGebied }) {
  const geoJsonRef = useRef();

  const normalized = useMemo(() => {
    if (!kerncijfers || !selectedIndicator) return {};
    const values = kerncijfers[selectedIndicator.id] || {};
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
  }, [kerncijfers, selectedIndicator]);

  const style = (feature) => {
    const code = feature.properties.code;
    const value = normalized[code];
    const isSelected = selectedGebied?.code === code;
    return {
      fillColor: getColor(value, selectedIndicator?.higherIsWorse),
      weight: isSelected ? 3 : 1,
      color: isSelected ? '#fff' : '#444',
      fillOpacity: isSelected ? 0.9 : 0.7,
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
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <GeoJSON
        key={selectedIndicator?.id || 'default'}
        ref={geoJsonRef}
        data={geojson}
        style={style}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
