import { describe, expect, it } from 'vitest';
import { continuityOwnedNpcs } from './actorOwnership';
describe('NPC Codex ownership', () => {
  const npcs = [{ name: 'Ari Vale' }, { name: 'Cato Vale' }];
  it('suppresses only accepted actor rows without changing stored records', () => {
    expect(continuityOwnedNpcs(npcs, { ownsActor: name => name === 'Ari Vale' })).toEqual([{ name: 'Cato Vale' }]);
    expect(npcs).toHaveLength(2);
  });
  it('keeps BaiBai fallback when Codex is unavailable, disabled, ambiguous or throws', () => {
    expect(continuityOwnedNpcs(npcs, {})).toEqual(npcs);
    expect(continuityOwnedNpcs(npcs, { ownsActor: () => false })).toEqual(npcs);
    expect(continuityOwnedNpcs(npcs, { ownsActor: () => { throw new Error('unavailable'); } })).toEqual(npcs);
  });
});
