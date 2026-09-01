export interface SaveMeta {
  slotId: string;
  savedAtUnixMs: number;
  day: number;
}

interface StoredRecord<T> {
  slotId: string;
  savedAtUnixMs: number;
  day: number;
  payload: T;
}

export type SaveLoadResult<T> =
  | { status: "ok"; payload: T; meta: SaveMeta; source: "current" | "backup" }
  | { status: "missing" }
  | { status: "corrupt"; error: string }
  | { status: "unavailable"; error: string };

export class IndexedDbSaveRepository<T> {
  private database: IDBDatabase | null = null;
  private unavailableReason: string | null = null;
  private readonly databaseName = "stranded2";
  private readonly storeName = "slots";

  public async open(): Promise<void> {
    if (this.database || this.unavailableReason) return;
    try {
      this.database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.databaseName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName, { keyPath: "slotId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
        request.onblocked = () => reject(new Error("IndexedDB wird von einem anderen Tab blockiert."));
      });
      this.database.onversionchange = () => {
        this.database?.close();
        this.database = null;
      };
    } catch (error) {
      this.unavailableReason = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  public async hasCurrent(): Promise<boolean> {
    const result = await this.readRecord("current");
    return result !== null;
  }

  public async getMeta(): Promise<SaveMeta | null> {
    const record = await this.readRecord("current");
    return record ? { slotId: record.slotId, savedAtUnixMs: record.savedAtUnixMs, day: record.day } : null;
  }

  public async save(payload: T, day: number): Promise<SaveMeta> {
    await this.ensureOpen();
    const database = this.requireDatabase();
    const previous = await this.readRecord("current");
    const meta: SaveMeta = { slotId: "current", savedAtUnixMs: Date.now(), day };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      if (previous) store.put({ ...previous, slotId: "backup" } satisfies StoredRecord<T>);
      store.put({ ...meta, payload } satisfies StoredRecord<T>);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Spielstand konnte nicht geschrieben werden."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Speichern wurde abgebrochen."));
    });
    return meta;
  }

  public async load(validate: (value: unknown) => value is T): Promise<SaveLoadResult<T>> {
    try {
      await this.ensureOpen();
      const current = await this.readRecord("current");
      if (!current) return { status: "missing" };
      if (validate(current.payload)) {
        return {
          status: "ok",
          payload: current.payload,
          meta: { slotId: current.slotId, savedAtUnixMs: current.savedAtUnixMs, day: current.day },
          source: "current",
        };
      }
      const backup = await this.readRecord("backup");
      if (backup && validate(backup.payload)) {
        return {
          status: "ok",
          payload: backup.payload,
          meta: { slotId: backup.slotId, savedAtUnixMs: backup.savedAtUnixMs, day: backup.day },
          source: "backup",
        };
      }
      return { status: "corrupt", error: "Der aktuelle und der gesicherte Spielstand sind beschädigt." };
    } catch (error) {
      return { status: "unavailable", error: error instanceof Error ? error.message : String(error) };
    }
  }

  public async deleteAll(): Promise<void> {
    await this.ensureOpen();
    const database = this.requireDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readwrite");
      transaction.objectStore(this.storeName).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Spielstand konnte nicht gelöscht werden."));
    });
  }

  private async readRecord(slotId: string): Promise<StoredRecord<T> | null> {
    await this.ensureOpen();
    const database = this.requireDatabase();
    return new Promise<StoredRecord<T> | null>((resolve, reject) => {
      const request = database.transaction(this.storeName, "readonly").objectStore(this.storeName).get(slotId);
      request.onsuccess = () => resolve((request.result as StoredRecord<T> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Spielstand konnte nicht gelesen werden."));
    });
  }

  private async ensureOpen(): Promise<void> {
    if (this.database) return;
    if (this.unavailableReason) throw new Error(this.unavailableReason);
    await this.open();
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) throw new Error(this.unavailableReason ?? "IndexedDB ist nicht verfügbar.");
    return this.database;
  }
}
