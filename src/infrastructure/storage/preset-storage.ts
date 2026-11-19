const STORE_NAME = 'presets';

function openPresetDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(name,1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME,{keyPath:'id'});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open preset database.'));
  });
}

export async function runPresetRequest<Result>(databaseName: string, mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<Result>): Promise<Result> {
  const database = await openPresetDatabase(databaseName);
  try {
    return await new Promise<Result>((resolve,reject) => {
      const transaction = database.transaction(STORE_NAME,mode);
      const request = execute(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('Preset operation aborted.'));
    });
  } finally {
    database.close();
  }
}

export function downloadPresetJson(filenamePrefix: string, name: string, preset: unknown): void {
  const blob = new Blob([JSON.stringify(preset,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  anchor.href = url;
  anchor.download = filenamePrefix + nameSlug + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

export async function readPresetJson(file: File): Promise<unknown> {
  if (file.size > 1024 * 1024) throw new Error('Preset file exceeds 1 MB.');
  const content = await file.text();
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON file.');
  }
}
