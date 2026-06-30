/**
 * stemStore — tiny IndexedDB wrapper for persisting uploaded stems / generated
 * beats in PersonalStudio across sessions.
 *
 * Schema:  DB "pp_personal_studio"
 *          store "stems" — key: stem.id (string)
 *                          value: { id, name, blob, duration, kind, createdAt }
 *
 *   kind = "upload" | "beat"  (cosmetic, lets the UI badge AI beats later)
 */
const DB_NAME = "pp_personal_studio";
const DB_VERSION = 1;
const STORE = "stems";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode) {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putStem(entry) {
  // entry: { id, name, blob, duration, kind }
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put({ ...entry, createdAt: entry.createdAt || Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listStems() {
  const store = await tx("readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeStem(id) {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStems() {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Convert a data: URL (e.g. AI beat preview_url) into a Blob for storage. */
export async function dataUrlToBlob(url) {
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    const r = await fetch(url);
    return r.blob();
  }
  return null;
}
