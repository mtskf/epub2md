# Architecture Decision Records

Documents significant architectural decisions made during development.

## ADR-1: Use Heading-Text Links Instead of Block IDs

**Date**: 2025-12-15
**Status**: Accepted
**Supersedes**: ADR-0 (HTML Anchors)

### Context

Initial implementation used HTML anchors (`<a id="...">`), which Obsidian doesn't recognize. We then tried Block IDs (`^id`), which worked but required explicit IDs on every heading.

### Decision

Use heading-text-based linking: `[[#Heading Text|link text]]`

**Implementation**:

- Pre-scan all chapters to build `headingTextMap` (ID → heading text)
- Resolve links by looking up heading text from ID
- Preprocess anchors to hoist IDs onto headings

### Consequences

**Positive**:

- More natural and readable
- Follows Obsidian's native behavior
- No need for explicit Block IDs everywhere

**Negative**:

- Duplicate heading text causes ambiguity (first match wins)
- Requires two-pass processing (pre-index, then convert)

**Mitigation**:

- Fallback to chapter anchors for unresolved IDs
- Document limitation in README

---

## ADR-2: Explicit Image Spacing

**Date**: 2025-12-15
**Status**: Accepted

### Context

Images were merging with subsequent headings because Turndown doesn't add spacing around block-level custom replacements.

### Decision

Explicitly wrap image output with `\n\n`:

```javascript
return `\n\n![${alt}](${src})\n\n`;
```

### Consequences

**Positive**:

- Prevents layout issues
- Consistent spacing

**Negative**:

- May create extra blank lines in some contexts

**Rule**: Never rely on Turndown's default spacing for block elements.

---

## ADR-3: Native Obsidian Footnotes

**Date**: 2025-12-15
**Status**: Accepted

### Context

EPUB footnotes use `<a href="#note1">[1]</a>` pattern, which doesn't integrate with Obsidian's footnote preview.

### Decision

Convert to Obsidian's native footnote syntax:

- References: `[^id]`
- Definitions: `[^id]: content`

**Implementation**:

- Heuristic detection: Links with text matching `/^\[?\d+\]?$/`
- Definition detection: Block elements starting with `[1]` pattern
- Cleanup: Remove `[1]` prefix and back-links

### Consequences

**Positive**:

- Native Obsidian footnote preview works
- Cleaner, more semantic Markdown

**Negative**:

- Heuristic may have false positives (mitigated by conservative regex)

---

## ADR-4: Dynamic Test Generation

**Date**: 2025-12-15
**Status**: Accepted

### Context

Static binary test files (`.epub`) are opaque and hard to debug.

### Decision

Generate test EPUB on-the-fly using `epub-gen` in test suite.

### Consequences

**Positive**:

- Test data is transparent and versionable
- Easy to add new test cases
- Debuggable (can inspect generated HTML)

**Negative**:

- Slightly slower test execution
- Dependency on `epub-gen` library

**Mitigation**: Cache generated EPUB between test runs if performance becomes an issue.
