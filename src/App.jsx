import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import DataTable from './components/DataTable';
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
      <div className="map-section">
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
      </div>
      <DataTable
        gebieden={gebieden}
        kerncijfers={kerncijfers}
        selectedGebied={selectedGebied}
        onSelectGebied={setSelectedGebied}
      />
    </div>
  );
}
