# BaiBai Book: English localization

Based on upstream 1.3.1, commit `cf83fcf7ea6c4267f8cf0683e66b40244f22c8cc`.

## Install the built extension

The English fork can be installed through SillyTavern's extension installer with `https://github.com/fadust/ST-BaiBai-Book`. It includes the built `dist/` files; no local build is needed. To replace an existing installation manually, follow the steps below.

1. Close SillyTavern and back up its data directory.
2. Extract the supplied ZIP into the same `third-party/ST-BaiBai-Book` extension directory used by the original. The folder must directly contain `manifest.json` and `dist/`.
3. Replace the original extension files with this build, then restart SillyTavern and refresh the browser.
4. Enable **BaiBai Book · Memory Engine** in Settings. Existing chat memory and settings use the same storage keys.

Do not enable the Chinese original and English build simultaneously: they share storage and generation hooks. Do not install the GitHub upstream URL expecting an English build; it serves the original version.

## Coverage

The English catalog covers UI text, dialogs, settings, tooltips, notifications, error messages, macro descriptions, and the six prompt/protocol text files. It also covers inline summary rules, batch summaries, NPC affinity and tracking, protagonist profiles, inventory, plans, life details, timeline instructions, compression, query rewriting, and injected context.

Generated descriptive memory and retrieval queries default to English. Proper names, verbatim evidence, JSON keys, enum values, variable paths, XML tags, and macros retain their original meaning and spelling. The five-query `INTENT:` / `Q:` protocol remains intact.

Every summary path explicitly requires English output, including single-message summaries, batch summaries, and both compression levels. The rule is repeated in the final generation checklist and applies even when source material, previous memories, or a custom template requests another language. Custom template text remains stored verbatim. Existing Chinese summaries are preserved; refresh after installing, then use the summary's regenerate action to replace one with a fresh English summary.

Batch summarize runs the full single-message extraction sequentially, so inventory, locations, NPCs, plans, and variables are recorded alongside summaries. Upstream's cheaper summary-only batch path omitted those fields. This English build uses one request per message and can cancel between messages. On the Summaries page, **Rebuild memory** repairs existing summary-only leaves by regenerating from the original story, oldest first. It retains leaf IDs and replaces a leaf only after a successful request; affected compressed parents are invalidated and eligible compression is rebuilt. Back up the chat before rebuilding if you want to retain the old generated wording.

English summary budgets are measured in words, with matching character ceilings of 2,100 for detailed and 1,050 for concise summaries. Higher-level compression counts input words rather than characters; its original ratios remain unchanged. This avoids applying Chinese character budgets to English prose.

## Saved-data compatibility

There is no saved-chat translation or schema migration. Existing `baibai_book` settings, `bbs_leaf` message extras, chat metadata, IDs, variable keys, and public interfaces stay unchanged. Unicode character names and custom variable paths are not rewritten.

Item and variable annotations accept both their legacy Chinese verbs and the English verbs. Newly generated annotations use English. Chinese date and age readers remain available; the age reader also accepts English forms such as `20 years old` and `about 20`.

An exact saved copy of any of the five upstream default templates is recognized without changing the stored text, including Windows line endings. Runtime requests and the prompt editor use the English built-in version. Customized templates, summaries, notes, variable meanings, lorebooks, character cards, and past chats remain as written; use **Restore default** in the prompt editor if you want to replace a customized Chinese template.

## Build and verify

Requires the same Node version as upstream Vite (Node 20.19+ or 22.12+).

```sh
npm install --ignore-scripts --package-lock=false
npm test
npm run test:english
npm run build
```

The resulting `dist/index.js`, `dist/index.css`, and source map are ready to copy to the extension directory. No translation service or localization network request runs in the extension. The original runtime dependencies are unchanged.

The upstream type check currently reports a missing `conditionPatch` label in `FloorPanel.vue` and missing Node type declarations in its Vite config. The English source check validates all transformed TS/Vue syntax; those existing type errors are documented rather than changed as part of localization.

## Merge future upstream updates

All translation data and compatibility logic live in `localization/`. `vite.english.config.mjs` applies them at build time. Upstream `src/` files have no content changes. Integration edits are limited to build/watch scripts, the display name, ignore entries, and a prompt-file line-ending rule for Windows checkouts.

1. Merge the next upstream commit using Git, preserving `localization/`, the English Vite config, and the English build commands.
2. Run `npm install --ignore-scripts --package-lock=false` if upstream dependencies changed.
3. Run `node localization/extract.mjs` to add new literal entries while retaining existing translations. Fill any empty entries in `localization/en.json`.
4. Review `localization/preserved.json`: its Chinese strings are legacy parser/discriminator tokens, not untranslated UI. New preservation exceptions require a compatibility reason.
5. Run `npm test`, `npm run test:english`, and `npm run build`. Checked source patches intentionally fail if their upstream anchors changed.
6. Distribute the rebuilt English `dist/` and manifest together.

The one-click upstream updater is blocked in this English build because it would install the Chinese bundle without rebuilding the localization. Version checks remain available.

The generated source map points at upstream source; build-time translation edits do not provide a separate mapping for translated literal columns.

## Verification limits

Automated checks cover translation coverage, TS/Vue syntax, identifier and schema-key stability, macro names, prompt structure, explicit English output rules, Unicode data, bilingual annotation readers, and timeline display. Live installation and UI checks are recorded in localization/LIVE-TEST.md. Model output quality and layout on every mobile theme require separate checks.
