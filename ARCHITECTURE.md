# Architecture Overview

Quick reference for system design and implementation.

## Conversion Pipeline

```
EPUB Input
    ↓
1. Pre-Index Headings (_preindexHeadingText)
    ↓
2. Preprocess Anchors (_preprocessAnchors)
    ↓
3. Convert to Markdown (Turndown + Custom Rules)
    ↓
Markdown Output
```

## Core Components

### Converter.js
Main conversion orchestrator with three key phases:

**Phase 1: Pre-Indexing**
- `_preindexHeadingText()`: Scans all chapters, builds `headingTextMap` (ID → heading text)
- Enables accurate link resolution to heading text

**Phase 2: Preprocessing**
- `_preprocessAnchors()`: Normalizes HTML structure
  - Hoists standalone `<a id="x"></a>` onto next heading
  - Converts chapter title paragraphs to `<h1>`
  - Promotes first heading to H1 if needed

**Phase 3: Markdown Conversion**
- Turndown with custom rules for images, links, footnotes
- See "Custom Rules" section below

## Custom Turndown Rules

### Images
- **Purpose**: Prevent merging with headings
- **Implementation**: Wrap with `\n\n`
- **Output**: `\n\n![alt](assets/file.jpg)\n\n`

### Internal Links
- **Strategy**: Heading-text-based (not Block IDs)
- **Process**: Extract ID from `href="#id"` → lookup `headingTextMap` → output `[[#Heading Text|text]]`
- **Fallback**: Chapter anchors if heading not found

### Footnotes
- **References**: `<a href="#note1">[1]</a>` → `[^note1]`
- **Definitions**: `<p id="note1">[1] Content</p>` → `[^note1]: Content`
- **Cleanup**: Remove `[1]` prefix and back-links

## Image Handling

1. **Extraction**: Before text conversion, scan manifest for `image/*` types
2. **Collision Avoidance**: Rename duplicates (`image.jpg` → `image_1.jpg`)
3. **Mapping**: Maintain `filenameMap` (original → safe filename)
4. **Resolution**: Use map during Markdown conversion

## Testing Strategy

- **Framework**: Jest
- **Approach**: Dynamic EPUB generation (not static binary)
- **Coverage**: Positive tests (feature works) + Negative tests (old formats don't appear)
- **Validation**: Regex for syntax integrity, not just content presence

## Key Design Decisions

See `docs/DECISIONS.md` for detailed ADRs:
- ADR-1: Heading-text links vs Block IDs
- ADR-2: Explicit image spacing
- ADR-3: Native Obsidian footnotes
- ADR-4: Dynamic test generation

## Known Limitations

- Duplicate heading text → first match wins
- Complex tables → HTML output
- MathJax/LaTeX → not supported
- CSS → ignored (relies on semantic HTML)

## File Structure

```
src/Converter.js       # Core conversion logic
test/
  converter.test.js    # Integration tests
  generate_test_epub.js # Dynamic test data
bin/epub2md.js         # CLI entry point
```

For implementation details and lessons learned, see:
- `docs/dev/LESSONS.md` - Development insights
- `docs/DECISIONS.md` - Architectural decisions
