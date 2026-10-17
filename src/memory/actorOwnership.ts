/** Suppress only the duplicate structured actor roster, never event history or stored data. */
export function continuityOwnedNpcs<T extends { name: string }>(npcs: T[], actor = (globalThis as typeof globalThis & {
  NPCStateDelta?: { ownsActor?: (name: string) => boolean };
}).NPCStateDelta): T[] {
  return npcs.filter(npc => {
    try { return actor?.ownsActor?.(npc.name) !== true; }
    catch { return true; }
  });
}
