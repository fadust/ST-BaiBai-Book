import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import { applyCompatibility, finishCompatibility } from './compat.mjs';

export const hasHan = text => /\p{Script=Han}/u.test(text);

// Work on literal contents, never identifiers, comments, JSON keys or regular expressions.
export function segments(source, filename) {
  const found = [];
  function add(start, end, kind = 'literal') {
    const text = source.slice(start, end);
    if (hasHan(text)) found.push({ start, end, text, kind });
  }
  function script(text, offset) {
    const ast = ts.createSourceFile(filename + '.ts', text, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (!(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
          && !ts.isLiteralTypeNode(node.parent)) add(offset + node.getStart(ast) + 1, offset + node.end - 1);
      } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        add(offset + node.getStart(ast) + 1, offset + node.end - (ts.isTemplateTail(node) ? 1 : 2));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  if (filename.endsWith('.txt')) {
    for (const match of source.matchAll(/[^\r\n]+/g)) add(match.index, match.index + match[0].length, 'text');
  } else if (filename.endsWith('.vue')) {
    const { descriptor } = parseSfc(source);
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (block) script(block.content, block.loc.start.offset);
    }
    const template = descriptor.template;
    if (template) {
      function visit(node) {
        const offset = template.loc.start.offset;
        if (node.type === 2) add(offset + node.loc.start.offset, offset + node.loc.end.offset, 'text');
        if (node.type === 5) script(node.content.content, offset + node.content.loc.start.offset);
        for (const prop of node.props ?? []) {
          if (prop.type === 6 && prop.value) {
            const start = offset + prop.value.loc.start.offset;
            const end = offset + prop.value.loc.end.offset;
            add(start + 1, end - 1, 'attribute');
          } else if (prop.type === 7 && prop.exp) script(prop.exp.content, offset + prop.exp.loc.start.offset);
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(baseParse(template.content));
    }
  } else script(source, 0);
  return found.sort((a, b) => a.start - b.start);
}

export function files(root = 'src') {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? files(file) : /\.(ts|vue|txt)$/.test(file) && !file.endsWith('.test.ts') ? [file] : [];
  });
}

export function translate(source, filename, catalog, preserved) {
  source = source.replaceAll('\r\n', '\n');
  const edits = segments(source, filename);
  for (const edit of edits.reverse()) {
    const relative = filename.replaceAll('\\', '/').split('/src/').pop().replace(/^src\//, '');
    if (preserved.some(entry => entry.file === relative && entry.text === edit.text
      && (!entry.before || source.slice(0, edit.start).endsWith(entry.before)))) continue;
    const english = catalog[edit.text];
    if (typeof english !== 'string' || (!english.trim() && edit.text !== ' 的摘要')) throw new Error(`Untranslated English text in ${filename}: ${edit.text.slice(0, 100)}`);
    if (edit.kind === 'literal' && /\$\{/.test(english)) {
      throw new Error(`Unsafe literal translation in ${filename}: ${english.slice(0, 100)}`);
    }
    const replacement = edit.kind === 'attribute' ? english.replaceAll('"', '&quot;')
      : edit.kind === 'literal' ? english.replace(/(?<!\\)["'`]/g, char => '\\' + char) : english;
    source = source.slice(0, edit.start) + replacement + source.slice(edit.end);
  }
  return source;
}

export function englishLocalization() {
  const catalog = JSON.parse(fs.readFileSync(new URL('./en.json', import.meta.url), 'utf8'));
  const preserved = JSON.parse(fs.readFileSync(new URL('./preserved.json', import.meta.url), 'utf8'));
  return {
    name: 'baibai-book-english', enforce: 'pre',
    load(id) {
      const filename = id.split('?')[0].replaceAll('\\', '/');
      if (filename.includes('/src/memory/prompts/') && filename.endsWith('.txt') && id.includes('?raw')) {
        return `export default ${JSON.stringify(translate(fs.readFileSync(filename, 'utf8'), filename, catalog, preserved))};`;
      }
    },
    transform(source, id) {
      if (id.includes('?')) return;
      const filename = id.split('?')[0].replaceAll('\\', '/');
      if (!filename.includes('/src/') || filename.endsWith('.test.ts') || !/\.(ts|vue)$/.test(filename)) return;
      source = applyCompatibility(source.replaceAll('\r\n', '\n'), filename);
      return { code: finishCompatibility(translate(source, filename, catalog, preserved), filename), map: null };
    },
  };
}
