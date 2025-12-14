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
        this.assetsDir = 'assets';
    }

    async convert(inputFile, outputDir) {
        this.inputFile = inputFile;
        this.outputDir = outputDir;
        this.assetsOutputDir = path.join(outputDir, this.assetsDir);

        console.log(`Reading EPUB: ${inputFile}`);
        const epub = await EPub.createAsync(inputFile);

        this._prepareDirectories();
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
    }

    _addRuleImages() {
        const imageReplacement = (content, node) => {
            const alt = node.getAttribute('alt') || '';
            let src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href');
            if (!src) return '';

            const basename = path.basename(src.split('?')[0]);
            const decodedBasename = decodeURIComponent(basename);
            const filename = this.filenameMap.get(decodedBasename) || decodedBasename;

            return `![${alt}](${this.assetsDir}/${filename})`;
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
                const href = node.getAttribute('href');
                // const id = node.getAttribute('id'); // ID on anchor tag itself is less relevant for Obsidian links unless it's a block anchor, which we handle via block rules.

                if (!href) return content;

                if (href.startsWith('http') || href.startsWith('mailto:')) {
                    return `[${content}](${href})`;
                }

                // Rewrite file.html#id to [[#^id|content]]
                const hashIndex = href.indexOf('#');
                if (hashIndex !== -1) {
                    const id = href.substring(hashIndex + 1); // Get ID without #
                    // Obsidian WikiLink format: [[#^id|content]]
                    // If content is empty or same as id? Just use content.
                    if (content) {
                        return `[[#^${id}|${content}]]`;
                    }
                     return `[[#^${id}]]`;
                }

                return content;
            }
        });
    }

    _addRuleObsidianIds() {
        // Add rule to append ^block-id to block elements with ID
        this.turndownService.addRule('obsidian-ids', {
            filter: (node) => {
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
                         return prefix + content + ` ^${id}`;
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
}

module.exports = Converter;
