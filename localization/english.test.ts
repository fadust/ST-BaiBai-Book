import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiSettings } from '@/api/settings';
import {
  SUMMARY_PROMPT, RESUMMARY_PROMPT, RESUMMARY2_PROMPT, SUMMARY_MACROS,
  SUMMARY_OUTPUT_PROTOCOL, CONDITION_PATCH_PROTOCOL, QUERY_REWRITE_SYSTEM, QUERY_REWRITE_TAIL,
  buildSummaryPrompt, buildSummaryThinking, buildBatchSummaryPrompt, buildBatchThinking,
  buildResummaryPrompt, buildPersonaSystem, buildWorldInfoSystem, buildCharCardSystem,
  fmtItemLogInline, isBuiltinSummaryPrompt, isLegacyBuiltinPrompt,
  RULE_ENGLISH_OUTPUT, RESUMMARY_THINKING_CHECKLIST,
} from '@/memory/prompts';
import { parseItemLogText, fmtVarOpsInline, finalizeVarOps } from '@/memory/apply';
import { weekdayLabel, relativeTimeLabel, ageDisplay } from '@/memory/timeRel';
import { readItemsTagText, readVarsTagText, writeItemLogTag, writeVarLogTag, TIME_TAG_PROMPT } from '@/memory/timeTag';
import { extractJsonObject } from '@/memory/json';
import { NPC_AFFINITY_FIELDS } from '@/memory/npcRelations';
import { performUpdate } from '@/memory/update';

const saved = { prompts: { ...apiSettings.prompts }, verbosity: apiSettings.verbosity, summaryOnlyMode: apiSettings.summaryOnlyMode };
afterEach(() => Object.assign(apiSettings, { ...saved, prompts: { ...saved.prompts } }));
const args = {
  user: 'Alice', char: 'Bob', time: '2026/10/10 12:00', location: 'School',
  protagonist: {}, sceneFocus: null, lifeDetails: [], items: [], itemLog: [], scenes: [], npcs: [],
  openPlans: [], resolvedPlans: [], history: 'HISTORY_SENTINEL', content: 'CONTENT_SENTINEL', hasTimeTags: true,
  varsState: {}, varsMeaning: '', varsRule: '',
};

describe('English prompts and schema contracts', () => {
  it('requires English output with Chinese source and custom templates on every summary path', () => {
    const input = { ...args, user: '小明', location: '学校', history: '旧摘要：小明回家。', content: '小明说明天回家。' };
    for (const custom of ['', '请用中文输出 {{content}}']) {
      Object.assign(apiSettings.prompts, { summary: custom, resummary: custom, resummary2: custom });
      const single = buildSummaryPrompt(input);
      const batch = buildBatchSummaryPrompt({ ...input, floorCount: 1 });
      const compressed = [1, 2].map(level => buildResummaryPrompt({ ...input, level }));
      for (const parts of [single, batch, ...compressed]) {
        expect(parts.system).toContain(RULE_ENGLISH_OUTPUT);
        expect(parts.user).toContain(input.content);
      }
      expect(buildSummaryThinking(input.user)).toContain(RULE_ENGLISH_OUTPUT);
      expect(buildBatchThinking(1)).toContain(RULE_ENGLISH_OUTPUT);
      expect(RESUMMARY_THINKING_CHECKLIST).toContain(RULE_ENGLISH_OUTPUT);
      if (custom) expect(apiSettings.prompts.summary).toBe(custom);
    }
    expect(RULE_ENGLISH_OUTPUT).toContain('Preserve JSON keys, enum values, IDs, macros, variable paths, proper names, and verbatim evidence or anchors exactly');
    for (const template of [SUMMARY_PROMPT, RESUMMARY_PROMPT, RESUMMARY2_PROMPT]) expect(template).toContain(RULE_ENGLISH_OUTPUT);
  });
  it('separates rules, source material and output protocol in English', () => {
    Object.assign(apiSettings.prompts, { summary: '', resummary: '', resummary2: '' });
    const parts = buildSummaryPrompt(args);
    expect(parts.user).toContain('CONTENT_SENTINEL');
    expect(parts.user).toContain('HISTORY_SENTINEL');
    expect(parts.system).not.toContain('CONTENT_SENTINEL');
    expect(parts.system).toContain('【Item rules】');
    expect(parts.system).toContain('【NPC rules】');
    expect(parts.system).toContain('If the narrative does not mention an age, omit it. Never guess from appearance.');
    expect(parts.system).not.toContain('Please fill in the form if it is not mentioned');
    expect(parts.system).toContain('【Plan and unresolved-thread rules】');
    expect(parts.user).toContain('【Current passage】');
    expect(buildSummaryThinking(args.user)).toContain(SUMMARY_OUTPUT_PROTOCOL);
    for (const text of [parts.user, parts.system, buildSummaryThinking(args.user)]) {
      expect(text).not.toMatch(/\p{Script=Han}/u);
      expect(text).not.toMatch(/\{\{\w+\}\}/);
    }
    expect(parts.system).toContain('"summary":');
    expect(parts.system).toContain('"stateChanges":');
    expect(CONDITION_PATCH_PROTOCOL).toContain('"evidence":');
    expect(CONDITION_PATCH_PROTOCOL).not.toContain('"evidence ":');
  });
  it('preserves every prompt macro token', () => {
    expect(SUMMARY_MACROS.map(macro => macro.token)).toContain('{{summary_max_chars}}');
    for (const [name, localized] of [['summary', SUMMARY_PROMPT], ['resummary', RESUMMARY_PROMPT], ['resummary2', RESUMMARY2_PROMPT]] as const) {
      const upstream = fs.readFileSync(`src/memory/prompts/${name}.txt`, 'utf8');
      const macros = (text: string) => [...text.matchAll(/\{\{\w+\}\}/g)].map(match => match[0]).sort();
      expect(macros(localized)).toEqual(macros(upstream));
      expect(localized).not.toMatch(/\p{Script=Han}/u);
    }
  });
  it('uses English word budgets and matching character ceilings', () => {
    apiSettings.prompts.summary = '';
    for (const [verbosity, words, cap] of [['detailed', '150-300', '2100'], ['concise', '80-150', '1050']] as const) {
      apiSettings.verbosity = verbosity;
      const parts = buildSummaryPrompt(args);
      expect(parts.system).toContain(words);
      expect(parts.system).toContain(cap);
    }
    apiSettings.verbosity = 'detailed';
    apiSettings.prompts.resummary2 = '';
    const compressed = buildResummaryPrompt({ ...args, content: 'word '.repeat(100), level: 2 });
    expect(compressed.system).toContain('40');
    expect(compressed.system).toContain('50');
    expect(compressed.user).toContain('word '.repeat(100).trim());
    expect(compressed.system).not.toContain('word word');
  });
  it('keeps the batch floors/n schema and source ordering', () => {
    const parts = buildBatchSummaryPrompt({ ...args, floorCount: 3 });
    const thinking = buildBatchThinking(3);
    expect(parts.system).toContain('"floors":');
    expect(parts.system).not.toContain('"messages":');
    expect(parts.system).toContain('"n":');
    expect(thinking).toContain('floors');
    expect(parts.user).toContain('CONTENT_SENTINEL');
    expect(parts.user + parts.system + thinking).not.toMatch(/\{\{\w+\}\}|\p{Script=Han}/u);
  });
  it('retains customized prompts and Unicode user data verbatim', () => {
    apiSettings.prompts.summary = 'CUSTOM {{content}} {{user}}';
    const parts = buildSummaryPrompt({ ...args, user: '小明', content: '未经翻译的已保存对话' });
    expect(parts.user).toContain('CUSTOM 未经翻译的已保存对话 小明');
    expect(isBuiltinSummaryPrompt()).toBe(false);
  });
  it('recognizes saved upstream defaults without editing the stored prompt', () => {
    const upstream = fs.readFileSync('src/memory/prompts/summary.txt', 'utf8').split('</nvwa_standalone_core>')[1].trim();
    apiSettings.prompts.summary = upstream;
    expect(isBuiltinSummaryPrompt()).toBe(true);
    expect(buildSummaryPrompt(args).system).not.toMatch(/\p{Script=Han}/u);
    expect(apiSettings.prompts.summary).toBe(upstream);
    expect(isLegacyBuiltinPrompt('summary', upstream.replaceAll('\n', '\r\n'))).toBe(true);
    expect(isLegacyBuiltinPrompt('summary', upstream + '\nCUSTOM RULE')).toBe(false);
    for (const key of ['resummary', 'resummary2']) {
      const template = fs.readFileSync(`src/memory/prompts/${key}.txt`, 'utf8').split('</nvwa_standalone_core>')[1].trim();
      expect(isLegacyBuiltinPrompt(key, template)).toBe(true);
    }
  });
  it('retains read-only persona, world and character wrappers', () => {
    for (const [builder, marker] of [[buildPersonaSystem, 'Protagonist persona'], [buildWorldInfoSystem, 'World setting'], [buildCharCardSystem, 'Character setting']] as const) {
      expect(builder('ORIGINAL_DATA')).toContain(marker);
      expect(builder('ORIGINAL_DATA')).toContain('ORIGINAL_DATA');
    }
  });
  it('keeps exactly five query targets and the INTENT/Q protocol', () => {
    expect(QUERY_REWRITE_SYSTEM).toContain('INTENT:');
    expect(QUERY_REWRITE_SYSTEM).toContain('Q:');
    expect(QUERY_REWRITE_TAIL).toMatch(/5/);
    expect(QUERY_REWRITE_SYSTEM + QUERY_REWRITE_TAIL + TIME_TAG_PROMPT).not.toMatch(/\p{Script=Han}/u);
    expect(TIME_TAG_PROMPT).toContain('bbs_start');
    expect(TIME_TAG_PROMPT).toContain('bbs_end');
  });
});

describe('saved-chat compatibility', () => {
  it('reads both Chinese and English item annotations and round-trips English output', () => {
    expect(parseItemLogText('获得 Magic sword 2\n消耗 Potion 1\n失去 Key 1')).toEqual([
      { name: 'Magic sword', qty: 2 }, { name: 'Potion', qty: -1 }, { name: 'Key', qty: -1 },
    ]);
    const inline = fmtItemLogInline([
      { name: 'Magic sword', kind: 'add', from: 0, to: 2, time: '' },
      { name: 'Potion', kind: 'update', from: 3, to: 2, time: '' },
      { name: 'Key', kind: 'remove', from: 1, to: 0, time: '' },
    ]);
    expect(inline).toBe('Gained Magic sword 2\nConsumed Potion 1\nLost Key 1');
    expect(parseItemLogText(inline)).toHaveLength(3);
    expect(parseItemLogText('gained Sword 2\nconsumed Potion 1')).toEqual([{ name: 'Sword', qty: 2 }, { name: 'Potion', qty: -1 }]);
  });
  it('recognizes both annotation languages without changing managed tags', () => {
    apiSettings.summaryOnlyMode = false;
    for (const inline of ['获得 剑 1', 'Gained Sword 1']) {
      const message = writeItemLogTag('<bbs_end>2026/10/10 12:00</bbs_end>', inline);
      expect(readItemsTagText(message)).toBe(inline);
      expect((writeItemLogTag(message, inline).match(/<bbs_items>/g) ?? []).length).toBe(1);
    }
    for (const inline of ['设定 关系.小明 5', 'Set relationship.Alice 5']) {
      expect(readVarsTagText(writeVarLogTag('Story', inline))).toBe(inline);
    }
    expect(fmtVarOpsInline([{ op: 'set', path: 'relationship.Alice', value: 5 }])).toContain('Set ');
  });
  it('keeps stored keys, variable paths, operations and affinity values', () => {
    const fixture = { summary: 'Saved story', items: { add: [{ name: '剑', qty: 2 }] }, vars: [{ op: 'set', path: '关系.小明', value: 5 }] };
    expect(extractJsonObject(JSON.stringify(fixture))).toEqual(fixture);
    expect(finalizeVarOps(fixture.vars)).toEqual(fixture.vars);
    expect(NPC_AFFINITY_FIELDS.map(field => field.key)).toEqual(['affinityInner', 'affinityOuter']);
    expect(NPC_AFFINITY_FIELDS[0].options.map(option => option.value)).toEqual(['', '-2', '-1', '0', '1', '2']);
  });
  it('displays English timeline labels while reading legacy dates and ages', () => {
    expect(weekdayLabel('2026/10/10 12:00')).toBe('Saturday');
    expect(relativeTimeLabel('2026年10月9日 12:00', '2026/10/10 12:00')).toBe('yesterday');
    expect(relativeTimeLabel('2026/10/9 12:00', '2026/10/10 12:00')).toBe('yesterday');
    expect(ageDisplay('20岁', '2024/10/10', '2026/10/10')).toContain('about 22 years old');
    expect(ageDisplay('20 years old', '2024/10/10', '2026/10/10')).toContain('about 22 years old');
  });
  it('prevents the upstream updater from replacing the English bundle', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(performUpdate()).rejects.toThrow('one-click updater would replace the English bundle');
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
