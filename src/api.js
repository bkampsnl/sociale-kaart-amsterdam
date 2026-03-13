const BASE = 'https://api.data.amsterdam.nl/v1';

export async function fetchGebieden() {
  const all = [];
  let url = `${BASE}/gebieden/ggwgebieden/?_format=json&_pageSize=100`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    all.push(...data._embedded.ggwgebieden);
    url = data._links.next?.href || null;
  }
  return all;
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

export async function fetchMeldingen(ggwCode, limit = 100) {
  const url = `${BASE}/meldingen/meldingen/?gbdGgwgebiedCode=${ggwCode}&_pageSize=${limit}&_format=json&_sort=-datumMelding`;
  const res = await fetch(url);
  const data = await res.json();
  return data._embedded.meldingen;
}

export async function fetchMeldingenByCategorie(ggwCode) {
  const meldingen = await fetchMeldingen(ggwCode, 500);
  const counts = {};
  for (const m of meldingen) {
    const cat = m.subcategorie || m.hoofdcategorie;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([categorie, aantal]) => ({ categorie, aantal }));
}
