# Changelog

All notable changes to FounderOS are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] — 2026-06-27

### Added
- **Liquid Glass** styling for the top navigation and the Quick Capture type switcher.
- **Pin** tasks (📌, unlimited) — pinned tasks float to the top of their group, separate from **Focus Day** (🎯, up to 3, shown on the Dashboard).
- **Quick deadline** chips (Today / Tomorrow / Next week / No date) plus a date picker in the task editor and Quick Capture.
- **Tasks** redesign: importance segment + *By group / All tasks* views; deadline categories are collapsible toggle lists (Overdue & Today open by default; state remembered) with item counts.
- **Search panel**: clicking the search box opens a slide-down panel; results appear only on Enter / *Search*; recent queries are remembered.
- **Save on Enter** in the task / idea / note / link editors (Cmd/Ctrl+Enter in multi-line fields). The journal is unaffected.
- Polished **empty states** across Tasks, Ideas, Notes, Links, Journal and Archive.
- Keyboard shortcut **`Q`** to open Quick Capture.

### Fixed
- Tabs/quick-add buttons no longer overlap the search box in the compact popup size.
- Dashboard overview cards and their arrows now open the matching section; arrows enlarged.
- *Last entry* in the Morning Overview now reflects the real most-recent journal entry (including unsaved drafts) instead of always showing “never”.

## [1.0.0] — 2026-06-25

### Added
- **Dashboard** with *Today's Focus* (up to 3 key tasks), Morning Overview and recent widgets.
- **Tasks** with deadlines, importance levels, automatic time grouping, filters and drag & drop reordering.
- **Ideas** with a pinned block and sorting (newest / oldest / pinned).
- **Notes** with pinning, local search and draft autosave.
- **Links** with a pinned block, clickable links and one-click *Add current tab*.
- **Daily Journal** with main goal, auto-pulled completed tasks, reflection prompts and day navigation.
- **Archive** for completed tasks and archived items, with restore and permanent delete.
- **Global Search** across all sections.
- **Quick Capture** modal and **keyboard shortcuts** (`T`, `I`, `N`, `L`, `/`, `Esc`).
- **Voice input** via the Web Speech API (graceful fallback when unsupported).
- **Draft autosave** for notes, journal entries and Quick Capture.
- **Localization** (English / Русский) with instant switching.
- **Import / Export** of all data as JSON, and *Clear archive*.
- Dark theme with SVG icons, animations and empty states.
