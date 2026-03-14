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

// Category groups for the dropdown and advice panel
export const INDICATOR_GROUPS = [
  { key: 'veiligheid', label: 'Veiligheid' },
  { key: 'overlast', label: 'Overlast & Leefbaarheid' },
  { key: 'sociaal', label: 'Sociaal' },
  { key: 'kwetsbaarheid', label: 'Kwetsbaarheid' },
  { key: 'wonen', label: 'Wonen & Ruimte' },
];

export const INDICATORS = [
  // ── Veiligheid ──
  {
    id: 'VMISDRIJF_1000INW', label: 'Misdrijven per 1.000 inwoners', group: 'veiligheid', higherIsWorse: true,
    description: 'Aantal geregistreerde misdrijven per 1.000 inwoners in deze wijk.',
    scale: 'aantal',
    interpret: (v) => v < 40 ? 'Laag' : v < 70 ? 'Gemiddeld' : v < 100 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'VBUURTVEILIG_R', label: 'Veiligheid buurt (1-10)', group: 'veiligheid', higherIsWorse: false,
    description: 'Rapportcijfer (1-10) dat bewoners geven voor de veiligheid in hun buurt.',
    scale: '1-10',
    interpret: (v) => v >= 7.5 ? 'Goed' : v >= 6.5 ? 'Voldoende' : v >= 5.5 ? 'Matig' : 'Onvoldoende',
  },
  {
    id: 'V_GERCRIM_HIC_I', label: 'High Impact Crime index', group: 'veiligheid', higherIsWorse: true,
    description: 'Index voor zware criminaliteit: overvallen, straatroof, woninginbraak. Hoger = meer zware criminaliteit.',
    scale: 'index',
    interpret: (v) => v < 80 ? 'Laag' : v < 100 ? 'Gemiddeld' : v < 130 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'VCRIMI_P', label: 'Criminaliteit: % veel', group: 'veiligheid', higherIsWorse: true,
    description: 'Percentage bewoners dat aangeeft veel criminaliteit te ervaren in de buurt.',
    scale: 'percentage',
    interpret: (v) => v < 10 ? 'Weinig' : v < 20 ? 'Gemiddeld' : v < 35 ? 'Veel' : 'Zeer veel',
  },
  {
    id: 'VDRUGSGEBR_P', label: 'Drugsoverlast (%)', group: 'veiligheid', higherIsWorse: true,
    description: 'Percentage bewoners dat overlast ervaart door drugsgebruik in de buurt.',
    scale: 'percentage',
    interpret: (v) => v < 5 ? 'Weinig' : v < 15 ? 'Gemiddeld' : v < 25 ? 'Veel' : 'Zeer veel',
  },
  // ── Overlast & Leefbaarheid ──
  {
    id: 'LOVERL_P', label: 'Overlast: % veel', group: 'overlast', higherIsWorse: true,
    description: 'Percentage bewoners dat aangeeft veel overlast te ervaren in de buurt.',
    scale: 'percentage',
    interpret: (v) => v < 10 ? 'Weinig' : v < 20 ? 'Gemiddeld' : v < 35 ? 'Veel' : 'Zeer veel',
  },
  {
    id: 'LJONGERENOVL_P', label: 'Overlast: jongeren (%)', group: 'overlast', higherIsWorse: true,
    description: 'Percentage bewoners dat overlast ervaart door groepen jongeren in de buurt.',
    scale: 'percentage',
    interpret: (v) => v < 10 ? 'Weinig' : v < 20 ? 'Gemiddeld' : v < 30 ? 'Veel' : 'Zeer veel',
  },
  {
    id: 'LLEEFBAARBRT_R', label: 'Leefbaarheid buurt (1-10)', group: 'overlast', higherIsWorse: false,
    description: 'Rapportcijfer (1-10) hoe prettig bewoners het vinden om in de buurt te wonen.',
    scale: '1-10',
    interpret: (v) => v >= 7.5 ? 'Goed' : v >= 6.5 ? 'Voldoende' : v >= 5.5 ? 'Matig' : 'Onvoldoende',
  },
  // ── Sociaal ──
  {
    id: 'LSOCCOH_R', label: 'Sociale cohesie (1-10)', group: 'sociaal', higherIsWorse: false,
    description: 'Rapportcijfer (1-10) voor sociale samenhang in de buurt.',
    scale: '1-10',
    interpret: (v) => v >= 7 ? 'Sterk' : v >= 6 ? 'Voldoende' : v >= 5 ? 'Matig' : 'Zwak',
  },
  {
    id: 'PEENZ_P', label: 'Eenzaamheid (%)', group: 'sociaal', higherIsWorse: true,
    description: 'Percentage bewoners (19+) dat ernstig eenzaam is.',
    scale: 'percentage',
    interpret: (v) => v < 8 ? 'Laag' : v < 14 ? 'Gemiddeld' : v < 20 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'LDISCRI_P', label: 'Discriminatie-ervaring (%)', group: 'sociaal', higherIsWorse: true,
    description: 'Percentage bewoners dat discriminatie ervaart in de buurt.',
    scale: 'percentage',
    interpret: (v) => v < 5 ? 'Weinig' : v < 12 ? 'Gemiddeld' : v < 20 ? 'Veel' : 'Zeer veel',
  },
  {
    id: 'LOMGANGGROEPENB_R', label: 'Omgang tussen groepen (1-10)', group: 'sociaal', higherIsWorse: false,
    description: 'Rapportcijfer (1-10) voor hoe verschillende groepen in de buurt met elkaar omgaan.',
    scale: '1-10',
    interpret: (v) => v >= 7 ? 'Goed' : v >= 6 ? 'Voldoende' : v >= 5 ? 'Matig' : 'Slecht',
  },
  // ── Kwetsbaarheid ──
  {
    id: 'SKKWETS34_P', label: 'Kwetsbaarheid hoog (%)', group: 'kwetsbaarheid', higherIsWorse: true,
    description: 'Percentage bewoners met een hoge kwetsbaarheidsscore.',
    scale: 'percentage',
    interpret: (v) => v < 15 ? 'Laag' : v < 30 ? 'Gemiddeld' : v < 45 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'SKSES234_P', label: 'SES laag (%)', group: 'kwetsbaarheid', higherIsWorse: true,
    description: 'Percentage bewoners met een lage sociaaleconomische status.',
    scale: 'percentage',
    interpret: (v) => v < 20 ? 'Laag' : v < 40 ? 'Gemiddeld' : v < 60 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'PUITKERING_1874_P', label: 'Uitkeringsdruk (%)', group: 'kwetsbaarheid', higherIsWorse: true,
    description: 'Percentage bewoners (18-74) met een uitkering.',
    scale: 'percentage',
    interpret: (v) => v < 5 ? 'Laag' : v < 10 ? 'Gemiddeld' : v < 18 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'WZDEPR_P', label: 'Psychische klachten (%)', group: 'kwetsbaarheid', higherIsWorse: true,
    description: 'Percentage bewoners met ernstige psychische problemen.',
    scale: 'percentage',
    interpret: (v) => v < 5 ? 'Laag' : v < 10 ? 'Gemiddeld' : v < 16 ? 'Hoog' : 'Zeer hoog',
  },
  {
    id: 'SK017_KWETS34_P', label: 'Kwetsbare kinderen (%)', group: 'kwetsbaarheid', higherIsWorse: true,
    description: 'Percentage kinderen (0-17) met een hoge kwetsbaarheidsscore.',
    scale: 'percentage',
    interpret: (v) => v < 15 ? 'Laag' : v < 30 ? 'Gemiddeld' : v < 45 ? 'Hoog' : 'Zeer hoog',
  },
  // ── Wonen & Ruimte ──
  {
    id: 'W_KRAP_P', label: 'Woningdruk: krap wonen (%)', group: 'wonen', higherIsWorse: true,
    description: 'Percentage bewoners dat krap woont (minder dan 20m² per persoon).',
    scale: 'percentage',
    interpret: (v) => v < 10 ? 'Laag' : v < 20 ? 'Gemiddeld' : v < 35 ? 'Hoog' : 'Zeer hoog',
  },
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

export async function fetchOpvanglocaties() {
  const all = [];
  let url = `${BASE}/maatschappelijke_voorzieningen/voorzieningen_op_de_kaart/?categorie=Opvanglocatie&_format=json&_pageSize=200`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    all.push(...data._embedded.voorzieningen_op_de_kaart);
    url = data._links.next?.href || null;
  }
  return all;
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
