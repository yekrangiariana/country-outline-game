const GEOJSON_URL = new URL(
  "../data/all_primary_countries.min.geojson",
  import.meta.url,
);
const MISSING_GEOMETRIES_URL = new URL(
  "../data/missing_geometries.geojson",
  import.meta.url,
);
const AUDIT_OVERRIDES_URL = new URL(
  "../data/geometry_overrides_audit.geojson",
  import.meta.url,
);
const BORDERS_CSV_URL = new URL(
  "../data/GEODATASOURCE-COUNTRY-BORDERS.CSV",
  import.meta.url,
);

const BORDER_OVERRIDES = [["SG", "MY"]];

const EXCLUDED_CONTINENTS = new Set(["Oceania", "Seven seas (open ocean)"]);

const COUNTRY_NAME_OVERRIDES = new Map([["IL", "Palestine"]]);

export function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function sample(items, rng = Math.random) {
  if (!items.length) {
    return null;
  }
  const index = Math.floor(rng() * items.length);
  return items[index];
}

export function shuffle(items, rng = Math.random) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAliasSet(props) {
  const candidates = [
    props.name,
    props.short_name,
    props.iso_short,
    props.formal_nam,
    props.sovereign,
  ];
  return new Set(candidates.map(normalize).filter(Boolean));
}

function ensureD3() {
  if (!globalThis.d3) {
    throw new Error(
      "D3 was not found. Ensure vendor/d3.v7.min.js is loaded first.",
    );
  }
  return globalThis.d3;
}

function hasRenderableGeometry(feature) {
  const geometry = feature?.geometry;
  if (!geometry || !geometry.type) {
    return false;
  }

  // GeoJSON geometries that can produce paths must have coordinate payloads.
  if (
    geometry.type === "GeometryCollection" &&
    !Array.isArray(geometry.geometries)
  ) {
    return false;
  }

  if (
    geometry.type !== "GeometryCollection" &&
    !Array.isArray(geometry.coordinates)
  ) {
    return false;
  }

  return true;
}

export async function loadGameData() {
  const d3 = ensureD3();

  const [geoRes, borderRes, supplementalRes, auditOverrideRes] =
    await Promise.all([
      fetch(GEOJSON_URL),
      fetch(BORDERS_CSV_URL),
      fetch(MISSING_GEOMETRIES_URL),
      fetch(AUDIT_OVERRIDES_URL),
    ]);

  if (!geoRes.ok) {
    throw new Error(`Failed to load country outlines: ${geoRes.status}`);
  }
  if (!borderRes.ok) {
    throw new Error(`Failed to load border dataset: ${borderRes.status}`);
  }
  if (!supplementalRes.ok) {
    throw new Error(
      `Failed to load missing geometries dataset: ${supplementalRes.status}`,
    );
  }
  if (!auditOverrideRes.ok) {
    throw new Error(
      `Failed to load audit override geometry dataset: ${auditOverrideRes.status}`,
    );
  }

  const [geojson, borderCsv, supplementalGeojson, auditOverrideGeojson] =
    await Promise.all([
      geoRes.json(),
      borderRes.text(),
      supplementalRes.json(),
      auditOverrideRes.json(),
    ]);
  const supplementalByIso3 = new Map();
  (supplementalGeojson.features || []).forEach((feature) => {
    const iso3 = (feature?.properties?.ADM0_A3 || "").toUpperCase();
    if (!iso3 || !hasRenderableGeometry(feature)) {
      return;
    }
    supplementalByIso3.set(iso3, feature);
  });

  const auditOverridesByIso2 = new Map();
  (auditOverrideGeojson.features || []).forEach((feature) => {
    const iso2 = (feature?.properties?.ISO_A2 || "").toUpperCase();
    if (!iso2 || !hasRenderableGeometry(feature)) {
      return;
    }
    auditOverridesByIso2.set(iso2, feature);
  });
  const borderRows = d3.csvParse(borderCsv);

  const countries = [];
  const iso2ToCountry = new Map();
  const aliasToIso2 = new Map();

  (geojson.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const iso2 = (props.iso_a2 || "").toUpperCase();
    const iso3 = (props.iso_a3 || "").toUpperCase();
    const continent = props.continent || "Unknown";
    if (!iso2) {
      return;
    }

    if (EXCLUDED_CONTINENTS.has(continent)) {
      return;
    }

    let featureForRender = feature;

    const auditOverride = auditOverridesByIso2.get(iso2);
    if (auditOverride) {
      featureForRender = {
        ...feature,
        geometry: auditOverride.geometry,
      };
    }

    if (!hasRenderableGeometry(featureForRender) && iso3) {
      const supplemental = supplementalByIso3.get(iso3);
      if (supplemental) {
        featureForRender = {
          ...feature,
          geometry: supplemental.geometry,
        };
      }
    }

    if (!hasRenderableGeometry(featureForRender)) {
      return;
    }

    const displayName =
      COUNTRY_NAME_OVERRIDES.get(iso2) || props.name || props.iso_short || iso2;
    const aliases = buildAliasSet(props);
    if (COUNTRY_NAME_OVERRIDES.has(iso2)) {
      aliases.add(normalize(displayName));
    }
    const country = {
      iso2,
      iso3,
      name: displayName,
      continent,
      feature: featureForRender,
      aliases,
      neighbors: new Set(),
    };

    countries.push(country);
    iso2ToCountry.set(iso2, country);
    aliases.forEach((alias) => {
      if (!aliasToIso2.has(alias)) {
        aliasToIso2.set(alias, iso2);
      }
    });
  });

  borderRows.forEach((row) => {
    const from = (row.country_code || "").trim().toUpperCase();
    const to = (row.country_border_code || "").trim().toUpperCase();
    if (!from || !to || from === to) {
      return;
    }

    const fromCountry = iso2ToCountry.get(from);
    const toCountry = iso2ToCountry.get(to);
    if (!fromCountry || !toCountry) {
      return;
    }

    // Land borders are bidirectional; enforce graph symmetry.
    fromCountry.neighbors.add(to);
    toCountry.neighbors.add(from);
  });

  BORDER_OVERRIDES.forEach(([a, b]) => {
    const left = iso2ToCountry.get(a);
    const right = iso2ToCountry.get(b);
    if (!left || !right) {
      return;
    }
    left.neighbors.add(b);
    right.neighbors.add(a);
  });

  countries.forEach((country) => {
    country.neighborNames = [...country.neighbors]
      .map((iso2) => iso2ToCountry.get(iso2)?.name)
      .filter(Boolean)
      .sort();
  });

  return {
    countries,
    iso2ToCountry,
    aliasToIso2,
  };
}

export function drawOutline(svgEl, feature) {
  const d3 = ensureD3();
  const width = 640;
  const height = 380;

  if (!hasRenderableGeometry(feature)) {
    svgEl.innerHTML =
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="18" fill="#444">Outline unavailable</text>';
    return;
  }

  const projection = d3.geoMercator();
  projection.fitSize([width - 32, height - 32], feature);
  const path = d3.geoPath(projection);
  const pathD = path(feature);

  if (!pathD) {
    svgEl.innerHTML =
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="18" fill="#444">Outline unavailable</text>';
    return;
  }

  svgEl.innerHTML = "";
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", "translate(16 16)");

  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("class", "country-path");
  p.setAttribute("d", pathD);

  g.appendChild(p);
  svgEl.appendChild(g);
}

export function createSeededRandom(seedText) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  return function seededRandom() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
