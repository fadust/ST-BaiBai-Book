import { afterEach, expect, it, vi } from 'vitest';
import * as settings from '@/api/settings';
import * as host from '@/st/context';
import { memory } from './store';
import { createEmptyMemory, type MemNpc } from './types';
import { refreshInjection } from './inject';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.assign(memory, createEmptyMemory()); });
it('final host payload omits the owned actor and retains scene continuity, then restores fallback', () => {
  Object.assign(memory, createEmptyMemory());
  memory.state.location = 'Ari fixture tower';
  memory.npcs = [{ id: 'ari', name: 'Ari Vale', important: true, title: 'storm healer', condition: 'tired' } as MemNpc];
  const prompts = new Map<string, string>();
  vi.spyOn(settings, 'engineActiveHere').mockReturnValue(true);
  vi.spyOn(host, 'getContext').mockReturnValue({ chat: [], setExtensionPrompt: (key: string, text: string) => prompts.set(key, text) } as never);
  const oldMode = settings.apiSettings.summaryOnlyMode;
  const oldInjection = { ...settings.apiSettings.injection };
  settings.apiSettings.summaryOnlyMode = false;
  Object.assign(settings.apiSettings.injection, { npcs: true, scenes: true });
  let owned = true;
  vi.stubGlobal('NPCStateDelta', { ownsActor: (name: string) => owned && name === 'Ari Vale' });
  try {
    refreshInjection();
    expect(prompts.get('baibai_book_memory_state')).toContain('Ari fixture tower');
    expect(prompts.get('baibai_book_memory_state')).not.toContain('storm healer');
    expect(memory.npcs[0].title).toBe('storm healer');
    owned = false; refreshInjection();
    expect(prompts.get('baibai_book_memory_state')).toContain('storm healer');
  } finally {
    settings.apiSettings.summaryOnlyMode = oldMode;
    Object.assign(settings.apiSettings.injection, oldInjection);
  }
});

it('shares memory safeguards once across slots and retains them for either standalone slot', async () => {
  const { MEMORY_BRIEFING_NOTE, MEMORY_BRIEFING_END } = await import('./prompts');
  const { buildHistoryInjectionText, buildStateInjectionText, buildInjectionText } = await import('./inject');
  const oldMode = settings.apiSettings.summaryOnlyMode;
  settings.apiSettings.summaryOnlyMode = false;
  Object.assign(memory, createEmptyMemory()); memory.state.location = 'Greyhaven';
  const chat = [{ is_user: false, is_system: true, name: 'Narrator', mes: 'Ari waited.', extra: { bbs_leaf: { id: 'audit', text: 'Ari waited.', delta: {}, createdAt: 1, swipe: 0, v: 1 } } }];
  const prompts = new Map<string, string>();
  vi.spyOn(settings, 'engineActiveHere').mockReturnValue(true);
  vi.spyOn(host, 'getContext').mockReturnValue({ chat, setExtensionPrompt: (key: string, text: string) => prompts.set(key, text) } as never);
  try {
    expect(buildHistoryInjectionText()).toContain(MEMORY_BRIEFING_END);
    expect(buildStateInjectionText()).toContain(MEMORY_BRIEFING_END);
    expect(buildInjectionText().split(MEMORY_BRIEFING_NOTE)).toHaveLength(2);
    refreshInjection();
    expect([...prompts.entries()].filter(([k]) => k !== 'baibai_book_time_tag').map(([, v]) => v).join('').split(MEMORY_BRIEFING_NOTE)).toHaveLength(2);
    chat.length = 0; refreshInjection();
    expect(prompts.get('baibai_book_memory_state')).toContain(MEMORY_BRIEFING_END);
  } finally { settings.apiSettings.summaryOnlyMode = oldMode; }
});
