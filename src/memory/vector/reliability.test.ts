import { afterEach, expect, it, vi } from 'vitest';
import * as host from '@/st/context';
import * as settings from '@/api/settings';
import * as store from './store';
import { embedTexts } from './embed';
import { syncVectorIndex, ensureRecallIndex } from './index';
import { runVectorRecall } from './recall';
import * as rewrite from './rewrite';
import { memory } from '../store';
import { createEmptyMemory } from '../types';
const original = structuredClone(JSON.parse(JSON.stringify(settings.apiSettings.vector)));
afterEach(() => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    Object.assign(settings.apiSettings.vector, structuredClone(original));
    Object.assign(memory, createEmptyMemory());
});
function setup() {
    Object.assign(settings.apiSettings.vector, { enabled: true, embedding: { url: 'http://embedding.invalid/v1', model: 'fixture', key: '', timeoutSec: 1, retries: 0 } });
    const chat = [{ mes: 'Ari returned the ribbon.', is_user: false, extra: { bbs_leaf: { id: 'ari-1', text: 'Ari returned the ribbon.', delta: {}, swipe: 0 } } }];
    vi.spyOn(host, 'getContext').mockReturnValue({ chat, characterId: 0, characters: [{ avatar: 'ari-test.png' }], getCurrentChatId: () => 'ari-test' } as never);
    vi.spyOn(settings, 'engineActiveHere').mockReturnValue(true);
    vi.spyOn(store, 'vecReconcile').mockResolvedValue({ deleted: 0, missing: ['ari-1'], stalePayload: [] });
    return vi.spyOn(store, 'vecUpsert').mockResolvedValue({ upserted: 1 });
}
it('failed indexing reaches manual rebuild and recall, preserves summaries, and can recover', async () => {
    const upsert = setup();
    const before = JSON.stringify(memory);
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', request);
    await expect(syncVectorIndex()).rejects.toThrow('Failed to fetch');
    await expect(ensureRecallIndex()).rejects.toThrow('Failed to fetch');
    expect(upsert).not.toHaveBeenCalled(); expect(JSON.stringify(memory)).toBe(before);
    request.mockResolvedValue({ ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 0, 0] }] }) });
    await expect(syncVectorIndex()).resolves.toEqual({ embedded: 1, payloadUpdated: 0 });
    expect(upsert).toHaveBeenCalledTimes(1);
});
it('incomplete, nonfinite, zero, and inconsistent embeddings never reach vector storage', async () => {
    const upsert = setup();
    for (const vectors of [[], [[0, 0]], [[Infinity, 1]], [[1, 0], [1, 0]]]) {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: vectors.map((embedding, index) => ({ index, embedding })) }) }));
        await expect(syncVectorIndex()).rejects.toThrow();
    }
    expect(upsert).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ index: 0, embedding: [1] }, { index: 1, embedding: [1, 2] }] }) }));
    await expect(embedTexts(['one', 'two'])).rejects.toThrow();
});

it('recall stops after index failure, clears stale recall, and does not spend a query-rewrite call', async () => {
    setup();
    const ctx = host.getContext() as any;
    ctx.chatMetadata = { bbs_bundles: ['synthetic-prior'] };
    ctx.chat.push({ is_user: true, mes: 'Who has the ribbon?' });
    const prompts = new Map([['baibai_book_vector_recall', 'stale recall'], ['baibai_book_memory_history', 'Ari returned the ribbon.']]);
    ctx.setExtensionPrompt = (key: string, text: string) => prompts.set(key, text);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', request);
    const rewriteCall = vi.spyOn(rewrite, 'rewriteQuery');
    await runVectorRecall();
    expect(request).toHaveBeenCalledTimes(1);
    expect(rewriteCall).not.toHaveBeenCalled();
    expect(prompts.get('baibai_book_vector_recall')).toBe('');
    expect(prompts.get('baibai_book_memory_history')).toBe('Ari returned the ribbon.');
});

it('host proxy preserves selected endpoint/model and CSRF headers; never falls back after failure', async () => {
    setup();
    const ctx = host.getContext() as any;
    ctx.getRequestHeaders = () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic' });
    settings.apiSettings.vector.embedding.useHostProxy = true;
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embeddings: [[1, 0, 0]] }) });
    vi.stubGlobal('fetch', request);
    expect((await embedTexts(['Ari speaks softly.']))[0]).toEqual(Float32Array.from([1, 0, 0]));
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('/api/plugins/similharity/batch-embeddings');
    expect(options.headers['X-CSRF-Token']).toBe('synthetic');
    expect(JSON.parse(options.body)).toMatchObject({ source: 'vllm', apiUrl: 'http://embedding.invalid/v1', model: 'fixture' });
    request.mockClear().mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    await expect(embedTexts(['Ari'])).rejects.toThrow('Host embedding proxy unavailable');
    expect(request).toHaveBeenCalledTimes(1);
});

it('duplicate embedding response indexes cannot assign the wrong memory vector', async () => {
    setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 0] }, { index: 0, embedding: [0, 1] }] }) }));
    await expect(embedTexts(['Ari', 'ribbon'])).rejects.toThrow('missing or duplicate input indexes');
});
