import { expect, it } from 'vitest';
import { cleanBody } from './timeTag';

it('keeps story text when a start timestamp has a mistyped end closer', () => {
  const text = '<bbs_start>414/6/14 09:00</bbs_end>\nAri quietly accepts the blue ribbon.\n<bbs_end>414/6/14 09:05</bbs_end>\n<log>Not story</log>';
  expect(cleanBody(text)).toContain('Ari quietly accepts the blue ribbon.');
  expect(cleanBody(text)).not.toContain('Not story');
  expect(cleanBody('<bbs_start>414/6/14 09:00</bbs_start>\nAri waits.')).toContain('Ari waits.');
});
