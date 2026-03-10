const STORAGE_KEY = "borderlinesPlayedOutlineProgressV1";

function toIso2(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function sanitizeSeenMap(rawSeen) {
  const seen = {};
  if (!rawSeen || typeof rawSeen !== "object") {
    return seen;
  }

  Object.entries(rawSeen).forEach(([iso2, ts]) => {
    const cleanIso2 = toIso2(iso2);
    if (!cleanIso2) {
      return;
    }

    const numeric = Number(ts);
    seen[cleanIso2] = Number.isFinite(numeric) ? numeric : Date.now();
  });

  return seen;
}

function sanitizeStore(rawStore) {
  const byDataset = {};
  const rawByDataset = rawStore?.byDataset;
  if (!rawByDataset || typeof rawByDataset !== "object") {
    return { byDataset };
  }

  Object.entries(rawByDataset).forEach(([datasetId, payload]) => {
    const cleanDatasetId = String(datasetId || "").trim();
    if (!cleanDatasetId) {
      return;
    }

    byDataset[cleanDatasetId] = {
      seen: sanitizeSeenMap(payload?.seen),
    };
  });

  return { byDataset };
}

function ensureDatasetBucket(store, datasetId) {
  if (!store.byDataset[datasetId]) {
    store.byDataset[datasetId] = { seen: {} };
  }
  return store.byDataset[datasetId];
}

export function createPlayedProgressStore(storageKey = STORAGE_KEY) {
  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return { byDataset: {} };
      }
      const parsed = JSON.parse(raw);
      return sanitizeStore(parsed);
    } catch {
      return { byDataset: {} };
    }
  }

  function save(store) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
      return true;
    } catch {
      return false;
    }
  }

  function markSeen(datasetId, iso2) {
    const cleanDatasetId = String(datasetId || "").trim();
    const cleanIso2 = toIso2(iso2);
    if (!cleanDatasetId || !cleanIso2) {
      return false;
    }

    const store = load();
    const bucket = ensureDatasetBucket(store, cleanDatasetId);
    bucket.seen[cleanIso2] = Date.now();
    return save(store);
  }

  function markManySeen(datasetId, iso2List) {
    const cleanDatasetId = String(datasetId || "").trim();
    const values = Array.isArray(iso2List) ? iso2List : [];
    if (!cleanDatasetId || !values.length) {
      return false;
    }

    const store = load();
    const bucket = ensureDatasetBucket(store, cleanDatasetId);
    let updated = false;

    values.forEach((iso2) => {
      const cleanIso2 = toIso2(iso2);
      if (!cleanIso2) {
        return;
      }
      bucket.seen[cleanIso2] = Date.now();
      updated = true;
    });

    if (!updated) {
      return false;
    }

    return save(store);
  }

  function getSeenSet(datasetId) {
    const cleanDatasetId = String(datasetId || "").trim();
    if (!cleanDatasetId) {
      return new Set();
    }

    const store = load();
    const seen = store.byDataset?.[cleanDatasetId]?.seen || {};
    return new Set(Object.keys(seen));
  }

  function getSeenEntries(datasetId) {
    const cleanDatasetId = String(datasetId || "").trim();
    if (!cleanDatasetId) {
      return [];
    }

    const store = load();
    const seen = store.byDataset?.[cleanDatasetId]?.seen || {};
    return Object.entries(seen)
      .map(([iso2, timestamp]) => ({ iso2, timestamp: Number(timestamp) || 0 }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  return {
    markSeen,
    markManySeen,
    getSeenSet,
    getSeenEntries,
  };
}
