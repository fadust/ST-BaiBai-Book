import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { compileTemplate } from '@vue/compiler-sfc';
import { applyCompatibility, finishCompatibility } from './compat.mjs';
import { files, segments, translate } from './transform.mjs';

const catalog = JSON.parse(fs.readFileSync('localization/en.json', 'utf8'));
const preserved = JSON.parse(fs.readFileSync('localization/preserved.json', 'utf8'));
const macroList = text => [...text.matchAll(/\{\{([A-Za-z_]\w*)(?:::[^}]+)?\}\}/g)].map(match => match[1]).sort();
let checked = 0;
for (const file of files()) {
  const original = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  const patched = applyCompatibility(original, file);
  const english = translate(patched, file, catalog, preserved);
  const remaining = segments(english, file).filter(segment => !preserved.some(entry => entry.file === file.slice(4) && entry.text === segment.text));
  assert.deepEqual(remaining, [], `Chinese text remains in ${file}`);
  assert.deepEqual(macroList(english), macroList(patched), `Macros changed in ${file}`);
  const schemaKeys = text => [...text.replaceAll('\\"', '"').matchAll(/(?:^[ \t]*|[{,]\s*)"([A-Za-z_]\w*)"\s*:/gm)].map(match => match[1]).sort();
  assert.deepEqual(schemaKeys(english), schemaKeys(patched), `Prompt or embedded JSON keys changed in ${file}`);
  if (file.endsWith('.ts')) {
    const ast = ts.createSourceFile(file, finishCompatibility(english, '/' + file), ts.ScriptTarget.Latest, true);
    assert.deepEqual(ast.parseDiagnostics, [], `Invalid TypeScript: ${file}`);
    // Property names and identifiers are the storage/API contract, irrespective of translated values.
    function names(source) {
      const out = [];
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isIdentifier(node)) out.push(node.text);
        if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) out.push(node.name.text);
        ts.forEachChild(node, visit);
      }
      visit(tree);
      return out;
    }
    assert.deepEqual(names(english), names(patched), `Identifiers or schema keys changed in ${file}`);
  }
  if (file.endsWith('.vue')) {
    const { descriptor, errors } = parseSfc(english);
    assert.deepEqual(errors, [], `Invalid Vue SFC: ${file}`);
    if (descriptor.template) {
      const compiled = compileTemplate({ source: descriptor.template.content, filename: file, id: 'english-check' });
      assert.deepEqual(compiled.errors, [], `Invalid Vue template: ${file}`);
    }
    for (const script of [descriptor.script, descriptor.scriptSetup]) {
      if (!script) continue;
      const ast = ts.createSourceFile(file + '.ts', script.content, ts.ScriptTarget.Latest, true);
      assert.deepEqual(ast.parseDiagnostics, [], `Invalid Vue script: ${file}`);
    }
  }
  if (process.argv.includes('--emit')) {
    const target = path.join('.english-check', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, finishCompatibility(english, '/' + file));
  }
  checked++;
}
assert.throws(() => translate("const label = '全新未翻译内容';", 'src/new.ts', catalog, preserved), /Untranslated/);
assert.equal(translate("// 这是注释\nconst 稳定变量 = { '数据键': '保存' }; const regex = /旧聊天/;", 'src/example.ts', { '保存': 'Save' }, []), "// 这是注释\nconst 稳定变量 = { '数据键': 'Save' }; const regex = /旧聊天/;");
console.log(`English coverage, syntax, identifiers and macro checks passed for ${checked} files.`);
