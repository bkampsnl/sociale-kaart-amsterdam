import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import DetailPanel from './components/DetailPanel';
import SearchBar from './components/SearchBar';
import { fetchGebieden, fetchAllKerncijfers, INDICATORS } from './api';
import { gebiedenToGeoJSON } from './geo';

export default function App() {
  const [gebieden, setGebieden] = useState([]);
  const [geojson, setGeojson] = useState(null);
  const [kerncijfers, setKerncijfers] = useState(null);
  const [selectedGebied, setSelectedGebied] = useState(null);
  const [selectedIndicator, setSelectedIndicator] = useState(INDICATORS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [geb, kc] = await Promise.all([fetchGebieden(), fetchAllKerncijfers()]);
        setGebieden(geb);
        setGeojson(gebiedenToGeoJSON(geb));
        setKerncijfers(kc);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (error) return <div className="error">Fout bij laden: {error}</div>;

  return (
    <div className="app">
      <SearchBar
        gebieden={gebieden}
        onSelectGebied={setSelectedGebied}
        selectedIndicator={selectedIndicator}
        onSelectIndicator={setSelectedIndicator}
      />
      <div className="main-content">
        <div className="map-container">
          {loading ? (
            <div className="map-loading">Data laden van Amsterdam API...</div>
          ) : (
            <MapView
              geojson={geojson}
              kerncijfers={kerncijfers}
              selectedIndicator={selectedIndicator}
              selectedGebied={selectedGebied}
              onSelectGebied={setSelectedGebied}
            />
          )}
          <div className="legend">
            <span className="legend-item" style={{ background: '#2d8a4e' }}></span> Goed
            <span className="legend-item" style={{ background: '#a3be4c' }}></span> Gemiddeld
            <span className="legend-item" style={{ background: '#f0a030' }}></span> Aandacht
            <span className="legend-item" style={{ background: '#d32f2f' }}></span> Kwetsbaar
          </div>
        </div>
        <DetailPanel gebied={selectedGebied} kerncijfers={kerncijfers} />
      </div>
    </div>
  );
}
