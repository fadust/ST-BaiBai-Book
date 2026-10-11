import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as client from '@/api/client';
import * as settings from '@/api/settings';
import * as context from '@/st/context';
import type { STContext, STMessage } from '@/st/context';
import { batchBackfill, cancelBatchBackfill, regenerateFloor } from '@/memory/engine';
import { memory } from '@/memory/store';
import { createEmptyMemory } from '@/memory/types';
import { RULE_ENGLISH_OUTPUT } from '@/memory/prompts';

const original = { ...settings.apiSettings, prompts: { ...settings.apiSettings.prompts } };
const chat: STMessage[] = [];
const first = {
  summary: 'Alice takes a Notebook inside Library, where Bob is sitting.',
  timeStart: '2026/10/10 12:00', timeEnd: '2026/10/10 12:01', location: 'Library',
  scenes: { add: [{ path: ['Library'], desc: 'A public library.' }] },
  npcs: { add: [{ name: 'Bob', location: 'Library', locationEvidence: 'Bob sits inside Library' }] },
  items: { add: [{ name: 'Notebook', qty: 1, carried: true }] },
};
const second = {
  summary: 'Alice takes another Notebook inside Library. Bob stays there.',
  timeStart: '2026/10/10 12:01', timeEnd: '2026/10/10 12:02',
  items: { update: [{ name: 'Notebook', qty: 2 }] },
};
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(memory, createEmptyMemory());
  Object.assign(settings.apiSettings, { summaryOnlyMode: true, summaryMaxRetries: 0, resummaryThreshold: 0,
    higherResummaryThreshold: 0, prompts: { ...original.prompts, summary: '' } });
  chat.splice(0, chat.length, ...[
    'Alice enters Library. Bob sits inside Library. Alice takes a Notebook.',
    'Alice takes another Notebook inside Library. Bob stays there.',
  ].map(mes => ({ name: 'Bob', is_user: false, is_system: false, mes })));
  vi.spyOn(context, 'getContext').mockReturnValue({ chat, chatMetadata: {}, name1: 'Alice', name2: 'Bob',
    getCurrentChatId: () => 'english-batch-test' } as STContext);
  vi.spyOn(context, 'getCheckWorldInfo').mockResolvedValue(null);
  vi.spyOn(settings, 'engineActiveHere').mockReturnValue(true);
  vi.spyOn(settings, 'getChannelForTask').mockReturnValue(null);
  vi.spyOn(client, 'mainApiAvailable').mockReturnValue(true);
  vi.spyOn(client, 'requestViaMainApi').mockResolvedValueOnce(JSON.stringify(first)).mockResolvedValueOnce(JSON.stringify(second));
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
  Object.assign(settings.apiSettings, original, { prompts: { ...original.prompts } });
});

it('batch extraction populates inventory, locations and NPCs in chronological order without duplicates', async () => {
  expect(await batchBackfill({ floors: [1, 0] })).toEqual({ done: 2, total: 2, cancelled: false });
  const calls = vi.mocked(client.requestViaMainApi).mock.calls;
  expect(calls).toHaveLength(2);
  for (const [messages] of calls) expect(messages.at(-1)!.content).toContain(RULE_ENGLISH_OUTPUT);
  expect(calls[1][0].find(m => m.role === 'user')!.content).toContain('Notebook');
  expect(calls[1][0].find(m => m.role === 'user')!.content).toContain('A public library.');
  expect(memory.items).toMatchObject([{ name: 'Notebook', qty: 2 }]);
  expect(memory.scenes).toMatchObject([{ path: ['Library'] }]);
  expect(memory.npcs).toMatchObject([{ name: 'Bob' }]);
  expect(memory.state.location).toBe('Library');
  expect(chat[0].extra!.bbs_leaf!.delta).toHaveProperty('items');
  expect(chat[0].extra!.bbs_leaf!.delta).toHaveProperty('scenes');
  expect(chat[0].extra!.bbs_leaf!.delta).toHaveProperty('npcs');
  expect(await batchBackfill()).toEqual({ done: 0, total: 0, cancelled: false });
  expect(client.requestViaMainApi).toHaveBeenCalledTimes(2);
});

it('cancels between messages even inside a planned batch', async () => {
  vi.mocked(client.requestViaMainApi).mockReset().mockImplementationOnce(async () => {
    cancelBatchBackfill(); return JSON.stringify(first);
  });
  expect(await batchBackfill()).toEqual({ done: 1, total: 2, cancelled: true });
  expect(chat[0].extra!.bbs_leaf).toBeDefined();
  expect(chat[1].extra?.bbs_leaf).toBeUndefined();
});

it('leaves a failed message pending and continues without an extra fallback retry', async () => {
  vi.mocked(client.requestViaMainApi).mockReset().mockRejectedValueOnce(new Error('Test failure')).mockResolvedValueOnce(JSON.stringify(first));
  expect(await batchBackfill()).toEqual({ done: 1, total: 2, cancelled: false });
  expect(client.requestViaMainApi).toHaveBeenCalledTimes(2);
  expect(chat[0].extra?.bbs_leaf).toBeUndefined();
  expect(chat[1].extra!.bbs_leaf).toBeDefined();
});

it('regenerates a legacy summary-only leaf into full memory while retaining its identity', async () => {
  chat[0].extra = { bbs_leaf: { id: 'legacy-id', text: '旧摘要', delta: { time: '2026/10/10 12:01' },
    timeStart: first.timeStart, timeEnd: first.timeEnd, createdAt: 123, swipe: 0, v: 1 } };
  expect(await regenerateFloor(0)).toBe(true);
  expect(chat[0].extra!.bbs_leaf).toMatchObject({ id: 'legacy-id', createdAt: 123, text: first.summary });
  expect(memory.items).toMatchObject([{ name: 'Notebook', qty: 1 }]);
  expect(memory.scenes).toMatchObject([{ path: ['Library'] }]);
  expect(memory.npcs).toMatchObject([{ name: 'Bob' }]);
});

it('rebuilds existing leaves in order, preserves IDs and counts only successful replacements', async () => {
  for (const [floor, message] of chat.entries()) message.extra = { bbs_leaf: {
    id: `legacy-${floor}`, text: '旧摘要', delta: { time: first.timeEnd }, createdAt: 123, swipe: 0, v: 1,
  } };
  expect(await batchBackfill({ rebuild: true })).toEqual({ done: 2, total: 2, cancelled: false });
  expect(chat.map(m => m.extra!.bbs_leaf!.id)).toEqual(['legacy-0', 'legacy-1']);
  expect(memory.items).toMatchObject([{ name: 'Notebook', qty: 2 }]);
  expect(memory.scenes).toMatchObject([{ path: ['Library'] }]);
  expect(memory.npcs).toMatchObject([{ name: 'Bob' }]);
});

it('keeps previous memory and summary on a failed rebuild', async () => {
  const old = { id: 'legacy-id', text: 'Previous summary', delta: { time: first.timeEnd }, createdAt: 123, swipe: 0, v: 1 };
  chat.splice(1); chat[0].extra = { bbs_leaf: old };
  vi.mocked(client.requestViaMainApi).mockReset().mockRejectedValue(new Error('Test failure'));
  expect(await batchBackfill({ rebuild: true })).toEqual({ done: 0, total: 1, cancelled: false });
  expect(chat[0].extra!.bbs_leaf).toBe(old);
});
