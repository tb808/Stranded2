interface StoredSettings<T> {
  id: "current";
  payload: T;
}

export class IndexedDbSettingsRepository<T> {
  private database: IDBDatabase | null = null;
  private unavailableReason: string | null = null;
  private readonly databaseName = "stranded2-settings";
  private readonly storeName = "settings";

  public async open(): Promise<void> {
    if (this.database || this.unavailableReason) return;
    try {
      this.database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(this.storeName)) database.createObjectStore(this.storeName, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Einstellungen konnten nicht geöffnet werden."));
        request.onblocked = () => reject(new Error("Die Einstellungsdatenbank wird von einem anderen Tab blockiert."));
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

  public async load(validate: (value: unknown) => value is T): Promise<T | null> {
    await this.ensureOpen();
    const database = this.requireDatabase();
    const record = await new Promise<StoredSettings<T> | null>((resolve, reject) => {
      const request = database.transaction(this.storeName, "readonly").objectStore(this.storeName).get("current");
      request.onsuccess = () => resolve((request.result as StoredSettings<T> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Einstellungen konnten nicht gelesen werden."));
    });
    return record && validate(record.payload) ? record.payload : null;
  }

  public async save(payload: T): Promise<void> {
    await this.ensureOpen();
    const database = this.requireDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readwrite");
      transaction.objectStore(this.storeName).put({ id: "current", payload } satisfies StoredSettings<T>);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Einstellungen konnten nicht gespeichert werden."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Speichern der Einstellungen wurde abgebrochen."));
    });
  }

  private async ensureOpen(): Promise<void> {
    if (this.database) return;
    if (this.unavailableReason) throw new Error(this.unavailableReason);
    await this.open();
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) throw new Error(this.unavailableReason ?? "Einstellungsspeicher ist nicht verfügbar.");
    return this.database;
  }
}
