const BASE = 'https://api.data.amsterdam.nl/v1';

export async function fetchGebieden() {
  const all = [];
  let url = `${BASE}/gebieden/wijken/?_format=json&_pageSize=100`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    all.push(...data._embedded.wijken);
    url = data._links.next?.href || null;
  }
  // Filter out records without geometry or with an end date (inactive)
  return all.filter((g) => g.geometrie && !g.eindGeldigheid);
}

export const INDICATORS = [
  { id: 'VMISDRIJF_1000INW', label: 'Misdrijven per 1.000 inwoners', category: 'criminaliteit', higherIsWorse: true },
  { id: 'VBUURTVEILIG_R', label: 'Veiligheid buurt (1-10)', category: 'veiligheid', higherIsWorse: false },
  { id: 'LOVERL_P', label: 'Overlast: % veel', category: 'overlast', higherIsWorse: true },
  { id: 'SKKWETS34_P', label: 'Kwetsbaarheidsscore hoog (%)', category: 'kwetsbaarheid', higherIsWorse: true },
  { id: 'LSOCCOH_R', label: 'Sociale cohesie (1-10)', category: 'sociaal', higherIsWorse: false },
  { id: 'SKSES234_P', label: 'SES laag (%)', category: 'kwetsbaarheid', higherIsWorse: true },
  { id: 'VDRUGSGEBR_P', label: 'Overlast: drugsgebruik (%)', category: 'overlast', higherIsWorse: true },
  { id: 'LJONGERENOVL_P', label: 'Overlast: jongeren (%)', category: 'overlast', higherIsWorse: true },
  { id: 'VCRIMI_P', label: 'Criminaliteit: % veel', category: 'criminaliteit', higherIsWorse: true },
];

export async function fetchKerncijfers(indicatorId, jaar = 2024) {
  const all = [];
  let url = `${BASE}/bbga/kerncijfers/?indicatorDefinitieId=${indicatorId}&jaar=${jaar}&_pageSize=100&_format=json`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    all.push(...data._embedded.kerncijfers);
    url = data._links.next?.href || null;
  }
  if (all.length === 0 && jaar > 2022) {
    return fetchKerncijfers(indicatorId, jaar - 1);
  }
  return all;
}

export async function fetchAllKerncijfers() {
  const results = {};
  await Promise.all(
    INDICATORS.map(async (ind) => {
      const data = await fetchKerncijfers(ind.id);
      results[ind.id] = {};
      for (const row of data) {
        results[ind.id][row.gebiedcode15] = row.waarde;
      }
    })
  );
  return results;
}

// Parse "Keizersgracht 100" or "Keizersgracht 100A" into { street, number, letter }
export function parseAddressQuery(query) {
  const match = query.match(/^(.+?)\s+(\d+)\s*([a-zA-Z]?)$/);
  if (match) return { street: match[1].trim(), number: parseInt(match[2]), letter: match[3] || null };
  return { street: query.trim(), number: null, letter: null };
}

export async function searchStreets(query) {
  if (!query || query.length < 2) return [];
  const url = `${BASE}/bag/openbareruimtes/?naam[like]=${encodeURIComponent(query)}*&typeOmschrijving=Weg&_pageSize=8&_fields=naam,identificatie&_format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return (data._embedded?.openbareruimtes || []).map((s) => ({
    naam: s.naam,
    identificatie: s.identificatie,
    type: 'straat',
  }));
}

export async function searchAddresses(streetName, number, letter) {
  let url = `${BASE}/bag/nummeraanduidingen/?ligtAanOpenbareruimte.naam[like]=${encodeURIComponent(streetName)}*&huisnummer=${number}&_expandScope=adresseertVerblijfsobject&_pageSize=10&_format=json`;
  if (letter) url += `&huisletter=${letter.toUpperCase()}`;
  const res = await fetch(url, { headers: { 'Accept-Crs': 'EPSG:4326' } });
  const data = await res.json();
  const nummers = data._embedded?.nummeraanduidingen || [];
  const verblijfs = data._embedded?.adresseertVerblijfsobject || [];

  // Build a map of verblijfsobject id → geometry
  const geoMap = {};
  for (const v of verblijfs) {
    if (v.identificatie && v.geometrie) {
      geoMap[v.identificatie] = v.geometrie;
    }
  }

  return nummers
    .map((n) => {
      const label = `${n._links?.ligtAanOpenbareruimte?.title || streetName} ${n.huisnummer}${n.huisletter || ''}${n.huisnummertoevoeging ? '-' + n.huisnummertoevoeging : ''}`;
      const geom = geoMap[n.adresseertVerblijfsobjectId];
      return {
        naam: label,
        postcode: n.postcode,
        geometry: geom,
        type: 'adres',
      };
    })
    .filter((a) => a.geometry);
}

export async function fetchStreetGeometry(identificatie) {
  const url = `${BASE}/bag/openbareruimtes/${identificatie}?_fields=naam,geometrie&_format=json`;
  const res = await fetch(url, { headers: { 'Accept-Crs': 'EPSG:4326' } });
  return res.json();
}

export async function findWijkByCoord(lat, lon) {
  const url = `${BASE}/gebieden/wijken/?geometrie[contains]=${lat},${lon}&_pageSize=1&_fields=naam,code,identificatie&_format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const wijken = data._embedded?.wijken || [];
  return wijken[0] || null;
}

export async function fetchMeldingen(wijkCode, limit = 100) {
  const url = `${BASE}/meldingen/meldingen/?gbdWijkCode=${wijkCode}&_pageSize=${limit}&_format=json&_sort=-datumMelding`;
  const res = await fetch(url);
  const data = await res.json();
  return data._embedded.meldingen;
}

export async function fetchMeldingenByCategorie(wijkCode) {
  const meldingen = await fetchMeldingen(wijkCode, 500);
  const counts = {};
  for (const m of meldingen) {
    const cat = m.subcategorie || m.hoofdcategorie;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([categorie, aantal]) => ({ categorie, aantal }));
}
