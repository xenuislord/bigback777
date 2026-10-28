import type { AppState } from "../../../packages/shared/src/index.ts";
export type PendingEdit = {
  operationId: string;
  itemId: string;
  version: number;
  patch: Record<string, unknown>;
  label: string;
  conflict?: string;
};
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ||= new Promise((resolve, reject) => {
    const r = indexedDB.open("hearth-private-cache", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("data");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function read<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("data", "readonly").objectStore("data").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function write(key: string, value: unknown) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("data", "readwrite");
    tx.objectStore("data").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function clearPrivateCache() {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("data", "readwrite");
    tx.objectStore("data").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function cacheState(s: AppState) {
  await write("state", { ...s, messages: [], notifications: [] });
}

/** A conflict pauses that item's edits, while unrelated shopping edits can sync. */
export function nextQueuedEdit(queue: PendingEdit[]) {
  return queue.find(
    (edit, index) =>
      !edit.conflict &&
      !queue
        .slice(0, index)
        .some((previous) => previous.itemId === edit.itemId),
  );
}
