import type { STMessage } from '@/st/context';
import { cleanBody } from './timeTag';

// Separate from leafValid: edited summaries stay usable for memory, not presence authority.
export function presenceSource(chat: STMessage[], floor: number, chatId: string | null, groupId: string | null): string {
  if (!chatId || !Number.isInteger(floor) || floor < 0 || !chat[floor]) return '';
  // Two independent 32-bit accumulators detect source changes without retaining duplicate prose.
  let a = 2166136261, b = 5381, length = 0;
  const feed = (text: string) => {
    length += text.length;
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619);
      b = Math.imul(b, 33) ^ text.charCodeAt(i);
    }
  };
  feed(JSON.stringify([chatId, groupId, floor]));
  for (let i = 0; i <= floor; i++) {
    const m = chat[i];
    feed(JSON.stringify([m.name, !!m.is_user, !!m.is_system, m.swipe_id ?? 0, !!m.extra?.bbs_omit, cleanBody(m.mes)]));
  }
  return `v1:${length}:${a >>> 0}:${b >>> 0}`;
}
