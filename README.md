# BaiBai Book — English edition

This is a free-to-use English implementation of BaiBai Book. Credit and ownership of the original project remain with its original author. This fork will be taken down if the original author requests its removal.

BaiBai Book is a SillyTavern memory extension. It summarizes chat messages, compresses older summaries, tracks characters, inventory, locations, plans, and custom variables, and supplies relevant memory to the main chat model.

This edition localizes both the interface and the model-facing prompts. It preserves existing memory schemas and saved chats. The localization is applied during the build so the upstream source remains easy to merge.

Install this English edition through SillyTavern's extension installer using:

```text
https://github.com/fadust/ST-BaiBai-Book
```

The upstream GitHub URL supplies the Chinese original. Installation, compatibility details, validation, and upstream update instructions are in [LOCALIZATION.md](LOCALIZATION.md).

Start with the main API, or configure auxiliary channels in Settings. Vector recall is optional and requires embedding and query-rewrite configuration; reranking is optional. Your existing settings and memory remain attached to the same SillyTavern account and chats.

Known limitation: the reported manual summary merge issue remains under investigation. Live compression and vector recall have not been verified.

Original project and authorship: [baibai-git/ST-BaiBai-Book](https://github.com/baibai-git/ST-BaiBai-Book). [Original Chinese README](README.zh-CN.md) and the upstream API reference are retained in the package.
