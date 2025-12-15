# epub2md: Epub to Markdown Converter

A robust Node.js tool to convert EPUB files into Markdown, optimized for **Obsidian** and personal knowledge bases.

## ✨ Key Features

This tool was built to solve specific pain points in EPUB conversion:

1.  **Obsidian-Optimized Markdown**:
    - **ATX Headers**: Uses `# Heading` instead of underlined headers for outline compatibility.
    - **Fenced Code Blocks**: Uses \`\`\` for code blocks instead of indentation.
    - **Standard Lists**: Uses `-` for bullet points.

2.  **Robust Image Handling**:
    - **Extraction**: Extracts all images to an `assets/` subfolder.
    - **Collision Avoidance**: Automatically renames files like `image.jpg` to `image_1.jpg` to prevent overwrites.
    - **SVG Support**: Correctly handles cover images embedded in SVG tags.

3.  **Obsidian-Native Internal Links**:
    - **Heading-Text Links**: Converts internal links to `[[#Heading Text|link text]]` format
    - **Pre-Indexing**: Scans all chapters to map IDs to heading text for accurate resolution
    - **Anchor Preprocessing**: Hoists standalone `<a id>` tags onto headings for proper linking
    - **Native Footnotes**: Converts EPUB footnotes to Obsidian's `[^id]` syntax

4.  **Metadata & Frontmatter**:
    - Generates YAML Frontmatter (Title, Author, Publisher, Cover, etc.) by default.

5.  **User Experience**:
    - **Progress Bar**: Visual feedback during conversion.
    - **Comprehensive CLI**: Easy-to-use command line arguments.

## 🛠 Installation

```bash
git clone https://github.com/mtskf/epub2md.git
cd epub2md
npm install
npm link
```

_Running `npm link` makes the `epub2md` command available globally._

## 🚀 Usage

```bash
epub2md <input-file> [options]
```

### Options

- `-o, --output <dir>`: Specify output directory (default: same as input input).
- `--no-frontmatter`: Disable YAML Frontmatter generation.
- `-h, --help`: Display help information.

### Example

```bash
epub2md my-book.epub -o ./MyNotes
```

Generates `./MyNotes/my-book.md` and `./MyNotes/assets/`.

## 🧪 Testing

The project includes a comprehensive integration test suite that generates a complex EPUB on-the-fly to verify:

- Structure & Frontmatter
- Link fixing (Internal and Footnotes)
- Image extraction
- Formatting (Lists, Code, Styles)

Run tests with:

```bash
npm test
```

## 🏗 Documentation

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: System design and implementation details
- **[docs/CHANGELOG.md](./docs/CHANGELOG.md)**: User-facing changes and version history
- **[docs/DECISIONS.md](./docs/DECISIONS.md)**: Architecture Decision Records (ADRs)
- **[docs/LESSONS.md](./docs/LESSONS.md)**: Development lessons and best practices
