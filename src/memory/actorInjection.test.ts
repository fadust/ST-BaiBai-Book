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
