const fs = require('fs');
const path = require('path');
const EPub = require('epub2').EPub;
const TurndownService = require('turndown');

const { generateFrontmatter } = require('./utils/frontmatter');
const { normalizeHref, slugifyAnchor } = require('./utils/anchors');

const addImageRules = require('./rules/images');
const addLinkRules = require('./rules/links');
const addObsidianRules = require('./rules/obsidian');
const addFootnoteRules = require('./rules/footnotes');

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
            const coverPath = this.coverImageFilename ? path.join(this.assetsDir, this.coverImageFilename) : null;
            return generateFrontmatter(epub.metadata, coverPath);
        } else if (epub.metadata && epub.metadata.title) {
            return `# ${epub.metadata.title}\n\n`;
        }
        return '';
    }

    configureTurndown() {
        // Register modular rules
        addImageRules(this.turndownService, {
            assetsDir: this.assetsDir,
            filenameMap: this.filenameMap
        });

        addLinkRules(this.turndownService, {
            headingTextMap: this.headingTextMap,
            chapterAnchorMap: this.chapterAnchorMap
        });

        addObsidianRules(this.turndownService, {
            headingTextMap: this.headingTextMap
        });

        addFootnoteRules(this.turndownService);
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

                    if (epub.metadata.cover === id) {
                        this.coverImageFilename = filename;
                    }
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
            const normalizedHref = normalizeHref(chapter.href || '');
            const baseId = slugifyAnchor(normalizedHref || chapter.id || '');
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

    _getChapterAnchorFromHref(href) {
        const normalized = normalizeHref(href);
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
            const taggedHeading = match[0].replace(/<h([1-6])([^>]*)>/i, `<h$1 id="${anchorId}"$2>`);
            return text.replace(match[0], taggedHeading);
        }

        return `<p id="${anchorId}"></p>\n${text}`;
    }

    _preprocessAnchors(text) {
        if (!text) return text;

        const pendingAnchors = [];

        // Strip standalone anchors and keep their IDs so we can move them to the next heading.
        const withoutAnchors = text.replace(/<a\s+(?:id|name)="([^"]+)"[^>]*>\s*<\/a>/gi, (_, id) => {
            pendingAnchors.push(id);
            return '';
        });

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
        const normalizedHeadings = normalizedTitles.replace(
            /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
            (match, level, attrs, inner) => {
                let targetLevel = parseInt(level, 10);
                if (!firstHeadingSeen && targetLevel > 1) {
                    targetLevel = 1;
                }
                firstHeadingSeen = true;
                return `<h${targetLevel}${attrs}>${inner}</h${targetLevel}>`;
            }
        );

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

            const headingRegex = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;
            let match;
            while ((match = headingRegex.exec(normalized)) !== null) {
                const attrs = match[2];
                const innerRaw = match[3];
                const innerText = innerRaw.replace(/<[^>]+>/g, '').trim();

                if (!innerText) continue;

                // Check ID on the heading itself
                const idMatch = attrs.match(/id="([^"]+)"/i);
                if (idMatch) {
                    this.headingTextMap.set(idMatch[1], innerText);
                }

                // Check IDs on children (e.g. <a id="..."> or <span id="...">)
                // We use a simple regex for this as well since it's HTML string
                const childIdRegex = /id="([^"]+)"/gi;
                let childMatch;
                while ((childMatch = childIdRegex.exec(innerRaw)) !== null) {
                    this.headingTextMap.set(childMatch[1], innerText);
                }
            }
        }
    }
}

module.exports = Converter;
