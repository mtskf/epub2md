const fs = require('fs');
const path = require('path');
const EPub = require('epub2').EPub;
const TurndownService = require('turndown');

class Converter {
    constructor(options = {}) {
        this.options = options;
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-'
        });
        this.filenameMap = new Map();
        this.chapterAnchorMap = new Map();
        this.headingTextMap = new Map(); // id -> heading text
        this.assetsDir = 'assets';
    }

    async convert(inputFile, outputDir) {
        this.inputFile = inputFile;
        this.outputDir = outputDir;
        this.assetsOutputDir = path.join(outputDir, this.assetsDir);

        console.log(`Reading EPUB: ${inputFile}`);
        const epub = await EPub.createAsync(inputFile);

        this._prepareDirectories();
        this._buildChapterAnchorMap(epub);
        await this._preindexHeadingText(epub);
        await this.extractImages(epub);

        let content = this._generateFrontmatterRecursive(epub);

        this.configureTurndown();

        const chapters = await this.processChapters(epub);
        content += chapters;

        const outputFilename = path.basename(inputFile, path.extname(inputFile)) + '.md';
        const outputPath = path.join(outputDir, outputFilename);

        fs.writeFileSync(outputPath, content);
        console.log(`Saved Markdown to: ${outputPath}`);
        return outputPath;
    }

    _prepareDirectories() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        if (!fs.existsSync(this.assetsOutputDir)) {
            fs.mkdirSync(this.assetsOutputDir, { recursive: true });
        }
    }

    _generateFrontmatterRecursive(epub) {
        if (!this.options.noFrontmatter) {
            return this.generateFrontmatter(epub.metadata);
        } else if (epub.metadata && epub.metadata.title) {
             return `# ${epub.metadata.title}\n\n`;
        }
        return '';
    }

    generateFrontmatter(metadata) {
        if (!metadata) return '';
        const lines = ['---'];
        if (metadata.title) lines.push(`title: "${metadata.title.replace(/"/g, '\\"')}"`);
        if (metadata.creator) lines.push(`author: "${metadata.creator.replace(/"/g, '\\"')}"`);
        if (metadata.publisher) lines.push(`publisher: "${metadata.publisher.replace(/"/g, '\\"')}"`);
        if (metadata.language) lines.push(`language: "${metadata.language}"`);
        if (metadata.date) lines.push(`date: "${metadata.date}"`);
        lines.push('tags: [epub, book]');
        lines.push('---');
        lines.push('');
        return lines.join('\n') + '\n';
    }

    configureTurndown() {
        this._addRuleImages();
        this._addRuleInternalLinks();
        // Removed _addRuleAnchors();
        this._addRuleObsidianIds();
        this._addRuleFootnotes();
    }

    _addRuleImages() {
        const imageReplacement = (content, node) => {
            const alt = node.getAttribute('alt') || '';
            let src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href');
            if (!src) return '';

            const basename = path.basename(src.split('?')[0]);
            const decodedBasename = decodeURIComponent(basename);
            const filename = this.filenameMap.get(decodedBasename) || decodedBasename;

            // Add newlines to ensure separation from subsequent blocks (like headers)
            return `\n\n![${alt}](${this.assetsDir}/${filename})\n\n`;
        };

        this.turndownService.addRule('img', {
            filter: 'img',
            replacement: imageReplacement
        });

        this.turndownService.addRule('svg-image', {
            filter: 'image',
            replacement: imageReplacement
        });
    }

    _addRuleInternalLinks() {
        this.turndownService.addRule('internal-links', {
            filter: 'a',
            replacement: (content, node) => {
                const rawHref = node.getAttribute('href');
                // const id = node.getAttribute('id'); // ID on anchor tag itself is less relevant for Obsidian links unless it's a block anchor, which we handle via block rules.

                if (!rawHref) return content;
                const href = decodeURIComponent(rawHref);

                if (href.startsWith('http') || href.startsWith('mailto:')) {
                    return `[${content}](${href})`;
                }

                const hashIndex = href.indexOf('#');
                // Handle in-file anchors: file.html#id or just #id
                if (hashIndex !== -1) {
                    const id = href.substring(hashIndex + 1); // Get ID without #
                    const headingText = this.headingTextMap.get(id);
                    if (headingText) {
                        const label = content || headingText;
                        return `[[#${headingText}|${label}]]`;
                    }
                    if (content) {
                        return `[[#^${id}|${content}]]`;
                    }
                    return `[[#^${id}]]`;
                }

                // Links pointing to another chapter file (e.g. toc.xhtml)
                const chapterAnchor = this._getChapterAnchorFromHref(href);
                if (chapterAnchor) {
                    const headingText = this.headingTextMap.get(chapterAnchor);
                    const target = headingText || `^${chapterAnchor}`;
                    const label = content || headingText || chapterAnchor;
                    // If we have a heading text, use heading link; otherwise fall back to block link
                    if (headingText) {
                        return `[[#${headingText}|${label}]]`;
                    }
                    return `[[#${target}|${label}]]`;
                }

                return content;
            }
        });
    }

    _addRuleObsidianIds() {
        // Add rule to append ^block-id to block elements with ID
        this.turndownService.addRule('obsidian-ids', {
            filter: (node) => {
                // Heuristic: If a DIV has an ID and contains a Header, move the ID to the Header.
                // This ensures Obsidian links point to the Header (which is a valid block) instead of the wrapper (which flattens).
                if (node.nodeName === 'DIV' && node.hasAttribute('id')) {
                    const id = node.getAttribute('id');
                    // Find first direct or close header
                    const firstHeader = node.querySelector('h1, h2, h3, h4, h5, h6');
                    if (firstHeader && !firstHeader.hasAttribute('id')) {
                         firstHeader.setAttribute('id', id);
                         node.removeAttribute('id');
                         // We processed this DIV's ID, so we return false for the DIV itself (unless it matches other criteria, which DIV doesn't)
                         return false;
                    }
                }

                const tags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
                return tags.includes(node.nodeName.toLowerCase()) && node.hasAttribute('id');
            },
            replacement: (content, node) => {
                const id = node.getAttribute('id');
                // Since filter guarantees ID presence, we don't need 'if (id)' check here strictly, but good for safety.
                if (id) {
                     // Check if it's a heading
                    const headingMatch = node.nodeName.match(/^H([1-6])$/);
                    if (headingMatch) {
                         const level = parseInt(headingMatch[1]);
                         const prefix = '#'.repeat(level) + ' ';
                         // Store heading text for link rewriting
                         this.headingTextMap.set(id, content);
                         return prefix + content;
                    }

                    // Check if it's a list item
                    if (node.nodeName === 'LI') {
                        // Very basic list item support for IDs.
                        // Note: Losing ordered/unordered distinction if we override, but this only affects LI with IDs.
                        // Default to dash.
                        return '- ' + content + ` ^${id}`;
                    }

                    // Paragraphs / Blockquotes
                    // We might lose blockquote '>' if we just return content.
                    if (node.nodeName === 'BLOCKQUOTE') {
                         return '> ' + content + ` ^${id}`;
                    }

                    return content + ` ^${id}`;
                }
                // If it was a header but had no ID, we MUST still return standard markdown header
                // because this rule MATCHES the node. If we return 'content', it strips the header formatting!
                const headingMatch = node.nodeName.match(/^H([1-6])$/);
                if (headingMatch) {
                     const level = parseInt(headingMatch[1]);
                     const prefix = '#'.repeat(level) + ' ';
                     return prefix + content;
                }

                return content;
            }
        });
    }

    _addRuleFootnotes() {
        // Footnote Reference: [1] -> [^id]
        this.turndownService.addRule('footnote-ref', {
            filter: (node) => {
                // Check if it's an anchor with href starting with #
                if (node.nodeName === 'A' && node.getAttribute('href') && node.getAttribute('href').startsWith('#')) {
                    // Check if text content looks like [1] or 1
                    const text = node.textContent.trim();
                    return /^\[?\d+\]?$/.test(text);
                }
                return false;
            },
            replacement: (content, node) => {
                const href = node.getAttribute('href');
                const id = href.substring(1); // Remove #
                return `[^${id}]`;
            }
        });

        // Footnote Definition: content with ID -> [^id]: content
        this.turndownService.addRule('footnote-def', {
            filter: (node) => {
                const tags = ['p', 'div', 'li', 'aside'];
                if (!tags.includes(node.nodeName.toLowerCase())) return false;
                if (!node.hasAttribute('id')) return false;

                const text = node.textContent.trim();
                // Match [1] ... or 1. ... or 1 ...
                // Also check if ID is referenced? (Hard without state)
                // Heuristic: Content must start with [d] or d. AND have ID.
                return /^\[?\d+\]?/.test(text) && (node.getAttribute('epub:type') === 'footnote' || text.length < 500);
            },
            replacement: (content, node) => {
                const id = node.getAttribute('id');
                // Clean content: remove [1] or \[1\] or 1. at start
                // Turndown escapes [ to \[.
                let cleanContent = content.replace(/^(\\?\[)?\d+(\\?\])?\.?\s*/, '');

                // Remove Obsidian-style internal back-links generated by _addRuleInternalLinks
                // Supports both old Block ID format: [[#^ref1|^]] and new heading-text format: [[#Heading|↩]]
                cleanContent = cleanContent.replace(/\s*\[\[#[^\]]+\|(\^|↩|back)\]\]\s*$/i, '');

                return `[^${id}]: ${cleanContent}`;
            }
        });
    }

    async extractImages(epub) {
        if (!epub.manifest) return;

        const usedFilenames = new Set();
        const isTest = process.env.NODE_ENV === 'test';
        if (isTest) console.log('Extracting images...');

        for (const id in epub.manifest) {
            const item = epub.manifest[id];
            if (item['media-type'] && item['media-type'].startsWith('image/')) {
                try {
                    const data = await this.getImageData(epub, id);

                    let originalBasename = path.basename(item.href);
                    let filename = originalBasename;
                    let ext = path.extname(filename);
                    let name = path.basename(filename, ext);

                    let counter = 1;
                    while (usedFilenames.has(filename)) {
                        filename = `${name}_${counter}${ext}`;
                        counter++;
                    }
                    usedFilenames.add(filename);

                    const decodedOriginal = decodeURIComponent(originalBasename);
                    this.filenameMap.set(decodedOriginal, filename);

                    const destPath = path.join(this.assetsOutputDir, filename);
                    fs.writeFileSync(destPath, data);
                } catch (err) {
                    console.warn(`Warning: Could not extract image ${id}: ${err.message}`);
                }
            }
        }
    }

    async processChapters(epub) {
        let textContent = '';
        // Only use progress bar in non-test env to avoid log spam
        const useProgressBar = process.env.NODE_ENV !== 'test';
        let bar;

        if (useProgressBar) {
            const cliProgress = require('cli-progress');
            bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
            console.log('Converting chapters...');
        } else {
            console.log('Converting chapters (Headless Mode)...');
        }

        if (epub.flow && epub.flow.length > 0) {
             if (bar) bar.start(epub.flow.length, 0);

        for (const chapter of epub.flow) {
            let text = await this.getChapterText(epub, chapter.id);
            text = this._preprocessAnchors(text);
            const chapterAnchor = this._getChapterAnchor(chapter);
            if (chapterAnchor) {
                text = this._ensureChapterAnchor(text, chapterAnchor);
            }
            if (text) {
                    // Removed legacy anchor injection
                    const markdown = this.turndownService.turndown(text);
                    textContent += markdown + '\n\n---\n\n';
                }
                if (bar) bar.increment();
            }
            if (bar) bar.stop();
        } else {
            console.warn('No chapters found in epub.flow');
        }

        return textContent;
    }

    // _injectAnchors method removed

    getChapterText(epub, chapterId) {
        return new Promise((resolve) => {
            epub.getChapter(chapterId, (err, text) => {
                if (err) resolve('');
                else resolve(text);
            });
        });
    }

    getImageData(epub, id) {
        return new Promise((resolve, reject) => {
            epub.getImage(id, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    _buildChapterAnchorMap(epub) {
        this.chapterAnchorMap = new Map();
        if (!epub.flow) return;

        const used = new Set();

        for (const chapter of epub.flow) {
            const normalizedHref = this._normalizeHref(chapter.href || '');
            const baseId = this._slugifyAnchor(normalizedHref || chapter.id || '');
            if (!baseId) continue;

            let anchor = baseId;
            let counter = 1;
            while (used.has(anchor)) {
                anchor = `${baseId}-${counter++}`;
            }
            used.add(anchor);

            if (normalizedHref) this.chapterAnchorMap.set(normalizedHref, anchor);
            if (chapter.id) this.chapterAnchorMap.set(chapter.id, anchor);
        }
    }

    _normalizeHref(href) {
        if (!href) return '';
        const withoutFragment = href.split('#')[0];
        const withoutQuery = withoutFragment.split('?')[0];
        const decoded = decodeURIComponent(withoutQuery);
        return path.basename(decoded);
    }

    _slugifyAnchor(raw) {
        if (!raw) return '';
        const withoutExt = raw.replace(/\.x?html?$/i, '');
        const slug = withoutExt
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || '';
    }

    _getChapterAnchorFromHref(href) {
        const normalized = this._normalizeHref(href);
        return this.chapterAnchorMap.get(normalized);
    }

    _getChapterAnchor(chapter) {
        if (!chapter) return '';
        return this._getChapterAnchorFromHref(chapter.href) || this.chapterAnchorMap.get(chapter.id) || '';
    }

    _ensureChapterAnchor(text, anchorId) {
        if (!text || !anchorId) return text;

        // Attach anchor to first heading without ID. If none, prepend empty paragraph with ID.
        const headingRegex = /<h([1-6])([^>]*)>/i;
        const match = text.match(headingRegex);

        if (match && !/id\s*=/.test(match[0])) {
            const taggedHeading = match[0].replace(
                /<h([1-6])([^>]*)>/i,
                `<h$1 id="${anchorId}"$2>`
            );
            return text.replace(match[0], taggedHeading);
        }

        return `<p id="${anchorId}"></p>\n${text}`;
    }

    _preprocessAnchors(text) {
        if (!text) return text;

        const pendingAnchors = [];

        // Strip standalone anchors and keep their IDs so we can move them to the next heading.
        const withoutAnchors = text.replace(
            /<a\s+(?:id|name)="([^"]+)"[^>]*>\s*<\/a>/gi,
            (_, id) => {
                pendingAnchors.push(id);
                return '';
            }
        );

        // Turn known title paragraphs into headings (common in some EPUBs).
        const normalizedTitles = withoutAnchors.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
            const classMatch = attrs.match(/class="([^"]*)"/i);
            const classList = classMatch ? classMatch[1].toLowerCase() : '';

            const isChapterTitle = classList.includes('chaptitle');
            const isHeadingPara = classList.includes('head1');

            if (!isChapterTitle && !isHeadingPara) return match;

            const level = isChapterTitle ? 1 : 2;
            let idPart = '';
            if (!/id\s*=/.test(attrs) && pendingAnchors.length > 0) {
                const anchorId = pendingAnchors.shift();
                idPart = ` id="${anchorId}"`;
            }

            return `<h${level}${attrs}${idPart}>${inner}</h${level}>`;
        });

        // Promote the first heading in the chapter to h1 if it is deeper than h1.
        let firstHeadingSeen = false;
        const normalizedHeadings = normalizedTitles.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
            let targetLevel = parseInt(level, 10);
            if (!firstHeadingSeen && targetLevel > 1) {
                targetLevel = 1;
            }
            firstHeadingSeen = true;
            return `<h${targetLevel}${attrs}>${inner}</h${targetLevel}>`;
        });

        // Attach the pending anchors to the next heading without an ID.
        const attached = normalizedHeadings.replace(/<h([1-6])([^>]*)>/gi, (match, level, attrs) => {
            if (/id\s*=/.test(attrs) || pendingAnchors.length === 0) {
                return match;
            }
            const id = pendingAnchors.shift();
            return `<h${level}${attrs} id="${id}">`;
        });

        return attached;
    }

    async _preindexHeadingText(epub) {
        this.headingTextMap = new Map();
        if (!epub.flow) return;

        for (const chapter of epub.flow) {
            let text = await this.getChapterText(epub, chapter.id);
            text = this._preprocessAnchors(text);
            const chapterAnchor = this._getChapterAnchor(chapter);
            const normalized = this._ensureChapterAnchor(text, chapterAnchor);
            if (!normalized) continue;

            const headingRegex = /<h([1-6])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
            let match;
            while ((match = headingRegex.exec(normalized)) !== null) {
                const id = match[2];
                const inner = match[3].replace(/<[^>]+>/g, '').trim();
                if (id && inner) {
                    this.headingTextMap.set(id, inner);
                }
            }
        }
    }
}

module.exports = Converter;
