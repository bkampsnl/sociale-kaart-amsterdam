import { useState, useRef, useEffect } from 'react';
import { INDICATORS } from '../api';

export default function SearchBar({ gebieden, onSelectGebied, selectedIndicator, onSelectIndicator }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }
    const q = query.toLowerCase();
    const matches = gebieden
      .filter((g) => g.naam.toLowerCase().includes(q) || g.code.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
  }, [query, gebieden]);

  const handleSelect = (gebied) => {
    setQuery(gebied.naam);
    setShowSuggestions(false);
    onSelectGebied({ code: gebied.code, naam: gebied.naam, identificatie: gebied.identificatie });
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder="Zoek wijk..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((g) => (
              <li key={g.code} onClick={() => handleSelect(g)}>
                <span className="suggestion-name">{g.naam}</span>
                <span className="suggestion-code">{g.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <select
        value={selectedIndicator?.id || ''}
        onChange={(e) => {
          const ind = INDICATORS.find((i) => i.id === e.target.value);
          onSelectIndicator(ind);
        }}
      >
        {INDICATORS.map((ind) => (
          <option key={ind.id} value={ind.id}>
            {ind.label}
          </option>
        ))}
      </select>
    </div>
  );
}
