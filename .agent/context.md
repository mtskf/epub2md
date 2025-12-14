# Project Context

Quick reference for AI agents working on this project.

## Project Info
- **Name**: epub2md
- **Version**: 1.2.0
- **Purpose**: Convert EPUB to Obsidian-optimized Markdown
- **Status**: Active development

## Must-Read Documents (Priority Order)
1. `docs/dev/LESSONS.md` - Key development insights (always read first)
2. `ARCHITECTURE.md` - System design overview
3. `docs/DECISIONS.md` - Recent architectural decisions (latest 3-5 entries)

## Current Focus
- Obsidian compatibility (heading-text-based linking)
- Native footnote support (`[^id]` syntax)
- Robust EPUB parsing

## Known Limitations
- Duplicate heading text causes link ambiguity (first match wins)
- Complex tables converted to HTML by Turndown
- MathJax/LaTeX not supported

## Quick File Reference
- **Core Logic**: `src/Converter.js`
- **Tests**: `test/converter.test.js`
- **CLI Entry**: `bin/epub2md.js`
- **Config**: `.agent/rules.md`

## Key Concepts
- **Heading-Text Links**: `[[#Heading Text|link text]]` (not Block IDs)
- **Pre-Indexing**: Scan chapters first to build ID→heading map
- **Anchor Preprocessing**: Hoist standalone `<a id>` onto headings
- **Native Footnotes**: `[^id]` for refs, `[^id]: content` for defs

## Development Workflow
1. Read `docs/dev/LESSONS.md` before starting
2. Update `CHANGELOG.md` for user-facing changes
3. Add ADR to `docs/DECISIONS.md` for architectural changes
4. Extract lessons to `docs/dev/LESSONS.md` after completion
