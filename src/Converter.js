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
        this._addRuleAnchors();
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
                const id = node.getAttribute('id');
                let prefix = '';

                // If element has ID, preserve it as an anchor
                if (id) {
                    prefix = `<a id="${id}" name="${id}"></a>`;
                }

                if (!href) return content; // Should be handled by 'anchors' rule if no href, but just in case.

                if (href.startsWith('http') || href.startsWith('mailto:')) {
                    return `${prefix}[${content}](${href})`;
                }

                // Rewrite file.html#id to #id
                const hashIndex = href.indexOf('#');
                if (hashIndex !== -1) {
                    const hash = href.substring(hashIndex);
                    return `${prefix}[${content}](${hash})`;
                }

                return prefix + content;
            }
        });
    }

    _addRuleAnchors() {
        this.turndownService.addRule('anchors', {
            filter: (node) => node.nodeName === 'A' && node.hasAttribute('id') && !node.hasAttribute('href'),
            replacement: (content, node) => {
                // Preserve content inside the anchor if any
                return `<a id="${node.getAttribute('id')}" name="${node.getAttribute('id')}"></a>${content}`;
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
                    text = this._injectAnchors(text);
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

    _injectAnchors(htmlText) {
        // Headers: Inject BEFORE the tag to ensure clean Markdown headers
        // Result: <a id="val" name="val"></a><h1 id="val">...</h1>
        htmlText = htmlText.replace(/(<(?:h[1-6])[^>]*\s+id=["']([^"']+)["'][^>]*>)/gi, '<a id="$2" name="$2"></a>$1');

        // Others (p, div, span, li): Inject INSIDE (after opening tag)
        // Result: <p id="val"><a id="val" name="val"></a>...</p>
        htmlText = htmlText.replace(/(<(?:p|div|span|li)[^>]*\s+id=["']([^"']+)["'][^>]*>)/gi, '$1<a id="$2" name="$2"></a>');

        return htmlText;
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
}

module.exports = Converter;
