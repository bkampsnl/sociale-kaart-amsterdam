import proj4 from 'proj4';

proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957388243134,0.343987817378283,-1.87740163998045,4.0725 +units=m +no_defs');

function rdToWgs84(x, y) {
  const [lng, lat] = proj4('EPSG:28992', 'WGS84', [x, y]);
  return [lat, lng];
}

function convertCoords(coords) {
  if (typeof coords[0] === 'number') {
    const [lat, lng] = rdToWgs84(coords[0], coords[1]);
    return [lng, lat];
  }
  return coords.map(convertCoords);
}

export function convertGeometry(geometry) {
  return {
    type: geometry.type,
    coordinates: convertCoords(geometry.coordinates),
  };
}

export function gebiedenToGeoJSON(gebieden) {
  return {
    type: 'FeatureCollection',
    features: gebieden
      .filter((g) => g.geometrie)
      .map((g) => ({
        type: 'Feature',
        properties: {
          code: g.code,
          naam: g.naam,
          identificatie: g.identificatie,
        },
        geometry: convertGeometry(g.geometrie),
      })),
  };
}
