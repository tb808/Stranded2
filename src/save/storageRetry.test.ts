import { afterEach, expect, it, vi } from 'vitest';
import { IndexedDbSaveRepository } from './IndexedDbSaveRepository';
import { IndexedDbSettingsRepository } from './IndexedDbSettingsRepository';

afterEach(() => vi.unstubAllGlobals());

it.each(['save', 'settings'] as const)('öffnet %s nach einem vorübergehenden Speicherfehler erneut', async (kind) => {
  const get = () => {
    const request = { result: undefined, onsuccess: null as (() => void) | null };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  };
  const database = { transaction: () => ({ objectStore: () => ({ get }) }), onversionchange: null };
  let attempts = 0;
  const open = vi.fn(() => {
    if (++attempts === 1) throw new Error('vorübergehend gesperrt');
    const request = { result: database, onsuccess: null as (() => void) | null };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  });
  vi.stubGlobal('indexedDB', { open });
  const repository = kind === 'save' ? new IndexedDbSaveRepository<string>() : new IndexedDbSettingsRepository<string>();
  await expect(repository.open()).rejects.toThrow('vorübergehend gesperrt');
  const loaded = await repository.load((value): value is string => typeof value === 'string');
  expect(loaded).toEqual(kind === 'save' ? { status: 'missing' } : null);
  expect(open).toHaveBeenCalledTimes(2);
});

it('behandelt synchrone Schreibfehler im asynchronen Datenbankcallback', async () => {
  const request = { result: undefined, onsuccess: null as (() => void) | null };
  const abort = vi.fn();
  const transaction = {
    abort,
    objectStore: () => ({
      get: () => { queueMicrotask(() => request.onsuccess?.()); return request; },
      put: () => { throw new Error('Speicher voll'); },
    }),
  };
  const repository = new IndexedDbSaveRepository<string>();
  Object.assign(repository, { database: { transaction: () => transaction } });
  await expect(repository.save('Spielstand', 1)).rejects.toThrow('Speicher voll');
  expect(abort).toHaveBeenCalledOnce();
});
