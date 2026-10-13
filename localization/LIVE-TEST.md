# English localization live test

Tested October 10, 2026 against SillyTavern 1.19.0 release (`06bde939f`) at `http://127.0.0.1:8000/`, using BaiBai Book 1.3.1.

The English package was installed in SillyTavern's `public/scripts/extensions/third-party/ST-BaiBai-Book` directory. Installed JavaScript matches the compiled workspace build. The initial tests used SillyTavern's temporary chat, which was discarded by reloading after testing.

## Passed

- Extension startup, magic-wand entry, public-interface initialization, and all six navigation pages.
- All five default prompt editors: summary, compression, higher-level compression, task preamble, and time tags. Default text is English and macros remain unchanged. Editors were canceled without saving.
- API channel creation dialog opens; closing discards its unsaved draft.
- Variable template import rejects malformed JSON with an English error.
- Manual history import accepts a synthetic summary and retains Unicode story names.
- Legacy `{json, guide}` template import into the temporary chat preserves nested JSON keys, numeric and boolean values, a Unicode field name, and custom rule text. Export preserves the original `app`, `kind`, `version`, `json`, `meaning`, and `rule` contract; legacy `guide` becomes `rule` through the existing upstream migration.
- Desktop 1280×900 and mobile 390×844 layouts: navigation, settings, and prompt dialog remain usable. Temporary viewport overrides were reset.
- Final browser prompt contains the corrected age evidence rule: omit an age when the narrative does not mention it; never guess from appearance.
- No BaiBai Book browser console warnings or errors observed.
- After the live corrections: all 14 localization tests, the 75-file coverage/schema/macro checks, and the production build pass.

## Menu follow-up

The original translated menu template had an empty visible label. The English build now renders BaiBai Book as visible text next to a currentColor inline SVG book icon, using SillyTavern's normal extension row styling. It no longer depends on the Font Awesome book glyph for this entry. The focusable row has an accessible name and button role; mouse, Enter, and Space open the book and dismiss the menu. A regression test checks markup, keyboard handling, and idempotent registration. Live checks in the installed dark theme confirmed all three activation methods, exactly one menu entry, and no BaiBai Book warnings or errors. The patch remains isolated in localization/compat.mjs.

## Summary language and full memory follow-up

The default summary prompts were written in English but did not explicitly require English output. All summary paths now include an explicit English output rule, repeated in the final checklist, with exceptions for stable identifiers, proper names, and verbatim evidence. Existing custom templates remain stored verbatim.

Upstream's batch path both requested only summary/time and discarded returned state fields. The English batch path now runs full single-message extraction sequentially. Rebuild memory applies the same path to existing leaves, keeping IDs and replacing records only after successful extraction. Cancellation is checked between messages; API failures retain the previous leaf.

An existing chat was backed up before rebuilding five summary-only leaves through the installed UI and an auxiliary LLM channel. All five summaries were generated in English. Stored deltas now contain inventory, scenes, NPC, and location updates, and the corresponding pages display that data. Immediately after rebuilding, a saved-file comparison confirmed unchanged message count, original narrative, message names/dates, leaf IDs, creation times, and swipe identities. A later reload retained a newer version of the latest story message instead of restoring the older backup. Leaf identities and all three memory pages survived reload. Chat data, backups, credentials, and screenshots are not included in this repository. All 21 localization tests, 75-file coverage/schema/macro checks, and the production build pass.

## Corrections made during testing

### English spacing follow-up — October 13, 2026

Tested the actual translated Vue pages with synthetic long English descriptions and the production CSS. All six pages passed horizontal overflow checks at 320, 390, 768, and 1280 pixels. Character and situation field labels retain a 12-pixel gap before their values. Expanded settings and the channel dialog were checked at 320 pixels; message-panel character editors retain an 8-pixel gap with wrapping English labels. The fixtures use no real chats or API requests and are excluded from the repository. Layout overrides and display-prefix changes remain isolated in `localization/`.

Polished empty states, settings explanations, compression terminology, batch character limits, recall descriptions, count suffixes, and spacing in generated button/dialog labels. Corrected an age-rule translation that had reversed the instruction to omit unsupported ages. Changes remain in `localization/`; upstream source files are unchanged.

## Limits

The initial UI checks used synthetic data and no LLM. The follow-up exercised five real summary/extraction requests through the user's configured auxiliary channel. Live compression, embedding, reranking, query rewriting, other models, and generation across long chats remain unverified. Other themes and devices were not exhaustively tested. Upstream macro deprecation and unrelated-extension warnings are outside this localization change.

Use `LOCALIZATION.md` to merge upstream changes and rebuild; the built-in one-click updater is blocked because it would overwrite the English bundle.
