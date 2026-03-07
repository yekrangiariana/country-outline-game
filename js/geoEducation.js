const EARTH_RADIUS_KM = 6371.0088;

function normalizeIso2(value) {
  const iso2 = String(value || "")
    .trim()
    .toUpperCase();
  return iso2.length === 2 ? iso2 : "";
}

function toPairKey(iso2A, iso2B) {
  return iso2A < iso2B ? `${iso2A}|${iso2B}` : `${iso2B}|${iso2A}`;
}

export function createCountryDistanceLookup(iso2ToCountry) {
  const cacheByPair = new Map();

  function getDistanceKm(fromIso2Raw, toIso2Raw) {
    const fromIso2 = normalizeIso2(fromIso2Raw);
    const toIso2 = normalizeIso2(toIso2Raw);
    if (!fromIso2 || !toIso2) {
      return null;
    }

    if (fromIso2 === toIso2) {
      return 0;
    }

    const pairKey = toPairKey(fromIso2, toIso2);
    const cached = cacheByPair.get(pairKey);
    if (typeof cached === "number") {
      return cached;
    }

    const fromCountry = iso2ToCountry?.get?.(fromIso2);
    const toCountry = iso2ToCountry?.get?.(toIso2);
    const d3 = globalThis.d3;
    if (!fromCountry?.feature || !toCountry?.feature || !d3?.geoCentroid) {
      return null;
    }

    try {
      const fromPoint = d3.geoCentroid(fromCountry.feature);
      const toPoint = d3.geoCentroid(toCountry.feature);
      if (!Array.isArray(fromPoint) || !Array.isArray(toPoint)) {
        return null;
      }

      const radians = d3.geoDistance(fromPoint, toPoint);
      if (!Number.isFinite(radians)) {
        return null;
      }

      const km = Math.max(0, Math.round(radians * EARTH_RADIUS_KM));
      cacheByPair.set(pairKey, km);
      return km;
    } catch {
      return null;
    }
  }

  return {
    getDistanceKm,
  };
}
