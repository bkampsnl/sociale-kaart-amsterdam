import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { useRef, useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';

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

function FlyToArea({ geojson, selectedGebied, selectedStreet }) {
  const map = useMap();

  useEffect(() => {
    // If a street is selected, zoom to the street (tighter zoom)
    if (selectedStreet?.geometry) {
      const layer = L.geoJSON(selectedStreet.geometry);
      map.flyToBounds(layer.getBounds(), { padding: [80, 80], maxZoom: 15 });
      return;
    }
    if (!selectedGebied || !geojson) return;
    const feature = geojson.features.find(
      (f) => f.properties.code === selectedGebied.code
    );
    if (feature) {
      const layer = L.geoJSON(feature);
      map.flyToBounds(layer.getBounds(), { padding: [200, 200], maxZoom: 12 });
    }
  }, [selectedGebied?.code, selectedStreet, geojson, map]);

  return null;
}

function StreetHighlight({ selectedStreet }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    // Remove previous street layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!selectedStreet?.geometry) return;

    // Add street geometry as a highlighted layer
    const layer = L.geoJSON(selectedStreet.geometry, {
      style: {
        color: '#ff00ff',
        weight: 5,
        opacity: 0.9,
        fillColor: '#ff00ff',
        fillOpacity: 0.3,
      },
    });
    layer.addTo(map);
    layerRef.current = layer;

    // Add a label popup at the centroid
    if (selectedStreet.centroid) {
      const popup = L.popup({ closeButton: false, autoClose: false, closeOnClick: false, className: 'street-popup' })
        .setLatLng(selectedStreet.centroid)
        .setContent(`<strong>${selectedStreet.naam}</strong>`)
        .openOn(map);
      // Store popup ref for cleanup
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

export default function MapView({ geojson, kerncijfers, selectedIndicator, selectedGebied, selectedStreet, onSelectGebied }) {
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
      <FlyToArea geojson={geojson} selectedGebied={selectedGebied} selectedStreet={selectedStreet} />
      <StreetHighlight selectedStreet={selectedStreet} />
    </MapContainer>
  );
}
