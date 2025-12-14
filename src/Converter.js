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

        // 1. Prepare Output Directory
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        if (!fs.existsSync(this.assetsOutputDir)) {
            fs.mkdirSync(this.assetsOutputDir, { recursive: true });
        }

        // 2. Extract Images FIRST
        await this.extractImages(epub);

        // 3. Extract Metadata & Frontmatter
        let content = '';
        if (!this.options.noFrontmatter) {
            content += this.generateFrontmatter(epub.metadata);
        } else if (epub.metadata && epub.metadata.title) {
             content += `# ${epub.metadata.title}\n\n`;
        }

        // 4. Configure Turndown
        this.configureTurndown();

        // 5. Process Chapters
        const chapters = await this.processChapters(epub);
        content += chapters;

        // 6. Write to File
        const outputFilename = path.basename(inputFile, path.extname(inputFile)) + '.md';
        const outputPath = path.join(outputDir, outputFilename);

        fs.writeFileSync(outputPath, content);
        console.log(`Saved Markdown to: ${outputPath}`);
        return outputPath;
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
        const imageReplacement = (content, node) => {
            const alt = node.getAttribute('alt') || '';
            let src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href');
            if (!src) return '';

            const basename = path.basename(src.split('?')[0]);
            const decodedBasename = decodeURIComponent(basename);

            // Default to decoded basename if not found
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

    async extractImages(epub) {
        if (!epub.manifest) return;

        const usedFilenames = new Set();

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
        const cliProgress = require('cli-progress');
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

        console.log('Converting chapters...');
        // epub.flow might be undefined if structure is different?
        // But usually it exists.
        if (epub.flow && epub.flow.length > 0) {
             bar.start(epub.flow.length, 0);

            for (const chapter of epub.flow) {
                const text = await this.getChapterText(epub, chapter.id);
                if (text) {
                    const markdown = this.turndownService.turndown(text);
                    textContent += markdown + '\n\n---\n\n';
                }
                bar.increment();
            }
            bar.stop();
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
}

module.exports = Converter;
