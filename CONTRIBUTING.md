# Contributing to FounderOS

Thanks for your interest in improving FounderOS! This guide explains how the project is laid out and how to contribute.

## Philosophy

FounderOS is intentionally **lightweight and local-first**. Before adding a feature, ask:

- Does it serve a founder's daily workflow with **minimal clicks**?
- Can it work **fully offline**, with no servers, paid APIs or tracking?
- Does it keep the UI **simple** (we are not building Notion / Trello / a Kanban / Pomodoro)?

Features that require AI, external services, accounts or telemetry are out of scope.

## Project structure

```
FounderOS/
├── manifest.json          # Chrome MV3 manifest
├── popup.html             # Single entry point (popup and full-tab modes)
├── src/
│   ├── css/               # variables (tokens), base (layout), components
│   ├── js/
│   │   ├── main.js        # bootstrap, top bar, tabs, router
│   │   ├── store.js       # data layer over chrome.storage.local (single source of truth)
│   │   ├── i18n.js        # translation layer (t(), data-i18n)
│   │   ├── icons.js       # inline SVG icon set
│   │   ├── utils.js       # dates, ids, escaping, debounce, task grouping
│   │   ├── ui.js          # toast, modal, confirm, shared markup helpers
│   │   ├── drafts.js      # debounced draft autosave
│   │   ├── voice.js       # Web Speech API dictation
│   │   ├── search.js      # global search
│   │   ├── quickCapture.js# quick add modal
│   │   ├── shortcuts.js   # keyboard shortcuts
│   │   └── views/         # one module per section, each exports render()
│   └── locales/           # en.js, ru.js
└── icons/                 # extension icons
```

## Tech & conventions

- **Vanilla JS (ES modules)** — no build step, no dependencies. Just edit and reload the extension.
- All persistence goes through **`store.js`**; views never touch `chrome.storage` directly.
- All user-facing strings go through **`t('key')`** and live in `src/locales/`. Add a key to **both** `en.js` and `ru.js`.
- Use **SVG icons** from `icons.js` in the UI (emoji are fine in docs only).
- Keep functions small and readable; add comments only where intent isn't obvious.
- No `console.log`, no hardcoded secrets, no dead code in commits.

## Development workflow

1. Make your changes.
2. Load the extension via `chrome://extensions` → **Load unpacked**.
3. After editing, hit the **reload** icon on the extension card and reopen the popup.
4. Test the affected flows and check the DevTools console for errors.

## Submitting changes

1. Fork the repo and create a feature branch.
2. Keep commits focused and descriptive.
3. Update `CHANGELOG.md` under an *Unreleased* section if relevant.
4. Open a pull request describing **what** changed and **why**.

Thanks for contributing! 🚀
