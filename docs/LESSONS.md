# Development Lessons

Key insights and patterns learned during development. Read this before starting any task.

## Obsidian Compatibility

### Heading-Text Links vs Block IDs

**Context**: Internal links need to work in Obsidian
**Evolution**: HTML anchors → Block IDs (`^id`) → Heading-text links
**Current Solution**: `[[#Heading Text|link text]]`
**Key Insight**: Heading-text is more natural and maintainable than Block IDs
**When to apply**: Any internal linking feature

**Technical Details**:

- Pre-index all headings: `_preindexHeadingText()`
- Hoist standalone anchors: `_preprocessAnchors()`
- Map ID → heading text for link resolution

### Image Spacing

**Problem**: Images merge with subsequent headings in Markdown
**Solution**: Explicit `\n\n` wrapping in Turndown replacement
**Rule**: Never rely on Turndown's default spacing for block elements
**Code Pattern**: `return \`\n\n![alt](src)\n\n\``

### Footnote Compatibility

**Pattern**: Detect `[1]` text in links → convert to `[^id]`
**Cleanup Required**: Remove `[1]` prefix and back-links from definitions
**Regex Flexibility**: Support both Block ID and heading-text back-link formats
**Pattern**: `/\s*\[\[#[^\]]+\|(^|↩|back)\]\]\s*$/i`

## Testing Strategy

### Test Quality

**Anti-pattern**: Simple `toContain()` checks
**Best Practice**: Regex validation for syntax integrity
**Example**: `/\[.+?\]\(.+?\)/` to verify `[text](url)` format
**Why**: Ensures Markdown structure, not just content presence

### Test Coverage

**Positive Tests**: Feature works as expected
**Negative Tests**: Old/invalid formats don't appear
**Example**: `expect(content).not.toMatch(/<a\s+id=/)`
**Why**: Prevents regression to HTML anchors

### Dynamic Test Data

**Anti-pattern**: Static binary test files (opaque, hard to debug)
**Best Practice**: Generate EPUB on-the-fly with `epub-gen`
**Benefits**: Transparent, versionable, easy to extend

## EPUB Variability

### Library Differences

**Observation**: `nodepub` vs `epub-gen` produce different HTML structures
**Implication**: Converter must handle variations (e.g., `<p class="chaptitle">` vs `<h1>`)
**Strategy**: Preprocessing layer (`_preprocessAnchors`) normalizes structure

### Anchor Patterns

**Common Pattern**: Standalone `<a id="x"></a>` before headings
**Solution**: Hoist ID onto heading during preprocessing
**Edge Case**: Chapter title paragraphs → convert to `<h1>`

## Code Patterns

### Turndown Custom Rules

**Order Matters**: Rules are applied in registration order
**Specificity**: More specific filters should come first
**State Management**: Use instance variables (e.g., `headingTextMap`) for cross-rule data

### Regex Escaping

**Context**: Markdown uses special characters (`[`, `]`, `^`)
**Pattern**: Turndown escapes `[` to `\[` in content
**Implication**: Cleanup regex must handle both `[1]` and `\[1\]`

## Documentation

### Context Preservation

**Critical**: Implementation artifacts (walkthrough.md, implementation_plan.md)
**Why**: Preserve decision context across sessions
**When**: Update after major architectural changes
**Location**: `.gemini/antigravity/brain/<conversation-id>/`
