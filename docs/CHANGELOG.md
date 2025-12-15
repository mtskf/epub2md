# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Regression test for TOC internal link resolution.
- `tmp_epub/` to `.gitignore`.

### Fixed
- Fixed broken Table of Contents (TOC) links in generated Markdown for EPUBs with internal anchors nested within headings. Links now correctly point to the heading text compatible with Obsidian.

### Added

- Added `cover` property to YAML frontmatter pointing to the extracted cover image

### Refactor

- Split `src/Converter.js` into modular components under `src/rules/` and `src/utils/`
- Introduced ESLint and Prettier for code quality automation
- Added `npm run lint` and `npm run format` scripts

### Documentation

- Translated all `.agent` documentation to Japanese for better agent context management.

### Changed

- Internal links now use heading text instead of Block IDs
- Image output includes explicit spacing (`\n\n`) to prevent merging

### Fixed

- Images no longer merge with subsequent headings
- Footnote back-links properly removed from definitions

## [1.1.1] - 2025-12-15

### Added

- Comprehensive integration test suite
- Dynamic EPUB generation for testing

### Changed

- Modularized `Converter.js` into smaller internal methods
- Improved link rewriting logic

### Fixed

- Broken internal links due to invalid HTML nesting
- Image extraction collision handling

## [1.0.0] - Initial Release

### Added

- EPUB to Markdown conversion
- Obsidian-optimized output (ATX headers, fenced code blocks)
- Image extraction to `assets/` folder
- YAML frontmatter generation
- Progress bar for conversion
