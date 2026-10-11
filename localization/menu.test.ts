import { afterEach, expect, it, vi } from 'vitest';
import { injectMenuButton } from '@/menu';
import { openBook } from '@/state/ui';

vi.mock('@/state/ui', () => ({ openBook: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('renders one labeled menu entry and opens it by click, Enter, or Space', () => {
  let markup = '';
  let handler: (event: { type: string; key?: string; preventDefault: () => void; stopPropagation: () => void }) => void;
  let inserted = false;
  const hide = vi.fn();
  const append = vi.fn(() => { inserted = true; });
  vi.stubGlobal('$', (selector: string) => {
    if (selector === '#extensionsMenu') return { length: 1, append, hide };
    if (selector === '#bbs-menu-item') return { length: inserted ? 1 : 0 };
    markup = selector;
    return { on: (events: string, callback: typeof handler) => {
      expect(events).toBe('click keydown'); handler = callback;
    } };
  });
  injectMenuButton();
  injectMenuButton();
  expect(append).toHaveBeenCalledTimes(1);
  expect(markup).toContain('<span>BaiBai Book</span>');
  expect(markup).toContain('role="button" tabindex="0"');
  expect(markup).toContain('<svg');
  expect(markup).toContain('stroke="currentColor"');
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).not.toContain('fa-solid');
  expect(markup).not.toContain('class="list-group-item'); // SillyTavern changes these rows to role=listitem.
  const preventDefault = vi.fn(), stopPropagation = vi.fn();
  handler!({ type: 'keydown', key: 'Tab', preventDefault, stopPropagation });
  expect(openBook).not.toHaveBeenCalled();
  for (const event of [{ type: 'click' }, { type: 'keydown', key: 'Enter' }, { type: 'keydown', key: ' ' }]) {
    handler!({ ...event, preventDefault, stopPropagation });
  }
  expect(openBook).toHaveBeenCalledTimes(3);
  expect(hide).toHaveBeenCalledTimes(3);
  expect(preventDefault).toHaveBeenCalledTimes(3);
  expect(stopPropagation).toHaveBeenCalledTimes(3);
});
