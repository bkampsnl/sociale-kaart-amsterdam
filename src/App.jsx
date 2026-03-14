import { useState, useEffect } from 'react';
import './App.css';
import MapView from './components/MapView';
import DataTable from './components/DataTable';
import ScorePanel from './components/ScorePanel';
import SearchBar from './components/SearchBar';
import OpvangFilter from './components/OpvangFilter';
import AdviesPanel from './components/AdviesPanel';
import { fetchGebieden, fetchAllKerncijfers, INDICATORS } from './api';
import { gebiedenToGeoJSON } from './geo';

export default function App() {
  const [gebieden, setGebieden] = useState([]);
  const [geojson, setGeojson] = useState(null);
  const [kerncijfers, setKerncijfers] = useState(null);
  const [selectedGebied, setSelectedGebied] = useState(null);
  const [selectedStreet, setSelectedStreet] = useState(null);
  const [selectedIndicator, setSelectedIndicator] = useState({ id: '_draagkracht', label: 'Draagkracht-score', higherIsWorse: false, scale: 'draagkracht' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [opvangLocaties, setOpvangLocaties] = useState([]);
  const [asielLocaties, setAsielLocaties] = useState([]);

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
        onSelectStreet={setSelectedStreet}
        selectedGebied={selectedGebied}
        selectedIndicator={selectedIndicator}
        onSelectIndicator={setSelectedIndicator}
      />
      <div className="map-section">
        {loading ? (
          <div className="map-loading">Data laden van Amsterdam API...</div>
        ) : (
          <>
            <OpvangFilter onLocatiesChange={setOpvangLocaties} onAsielLocatiesChange={setAsielLocaties} />
            <MapView
              geojson={geojson}
              kerncijfers={kerncijfers}
              selectedIndicator={selectedIndicator}
              selectedGebied={selectedGebied}
              selectedStreet={selectedStreet}
              onSelectGebied={setSelectedGebied}
              onSelectStreet={setSelectedStreet}
              opvangLocaties={opvangLocaties}
              asielLocaties={asielLocaties}
            />
          </>
        )}
      </div>
      <ScorePanel
        kerncijfers={kerncijfers}
        selectedGebied={selectedGebied}
      />
      <DataTable
        gebieden={gebieden}
        geojson={geojson}
        kerncijfers={kerncijfers}
        selectedGebied={selectedGebied}
        selectedStreet={selectedStreet}
        onSelectGebied={setSelectedGebied}
        onSelectStreet={setSelectedStreet}
        selectedIndicator={selectedIndicator}
      />
      <AdviesPanel
        kerncijfers={kerncijfers}
        selectedGebied={selectedGebied}
        selectedStreet={selectedStreet}
        geojson={geojson}
      />
    </div>
  );
}
