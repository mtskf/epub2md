# Project History

This document tracks the evolution of the project, recording **what** changed, **why** it was changed, and **how** issues were resolved. Use this as context for future development.

## 2025-12-15: Robustness Improvements & Testing Infrastructure

### Context
User reported issues with broken internal links, missing images, and desired a more robust testing strategy.

### Changes
- **Refactor**: Modularized `Converter.js` into smaller internal methods (`_injectAnchors`, `_configureTurndown`, etc.).
- **Fix (Link Rewriting)**:
  - Previously, injecting anchors inside `<a>` tags caused invalid HTML nesting, resulting in broken Markdown links (e.g., `[](#id)`).
  - **Solution**: Changed logic to handle `<a>` tags separately in Turndown rules, ensuring IDs are preserved as sibling anchors or preserved attributes. Strict regex validation added to tests.
- **Testing**:
  - Replaced static `test.epub` with a dynamic generator (`generate_test_epub.js` using `epub-gen`).
  - Created `test/converter.test.js` covering:
    - Frontmatter generation
    - ATX Header styling
    - Image extraction (collision avoidance & `.jpeg` extension handling)
    - Internal link rewriting (including footnotes)
    - Formatting (Lists, Fenced Code, Bold/Italic, Blockquotes)
- **Documentation**: Added `ARCHITECTURE.md` and updated `README.md` to reflect current capabilities.

### Lessons Learned
- **Test Quality**: Simple `toContain` checks are insufficient for Markdown link verification. Tests must use regex to verify the syntax `[text](url)` is intact.
- **EPUB Variability**: Different libraries (`nodepub` vs `epub-gen`) produce slightly different HTML structures. The converter must be robust against these variations.

## 2025-12-15: Translate AI Context

### Context
User requested `GEMINI.md` to be in English.

### Changes
- **Docs**: Translated `GEMINI.md` from Japanese to English.

### Lessons Learned
- Validating the new automated PR workflow.

## 2025-12-15: Separate AI Context

### Context
User requested separation of public and private AI context.

### Changes
- **Docs**: 
  - Moved private/preference rules (Persona, Language, Automation) to local `.agent/rules.md`.
  - Reinstated `GEMINI.md` as a public document containing only Project Vision and Philosophy.
  - Removed `GEMINI.md` from `.gitignore`.
