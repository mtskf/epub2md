#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const Converter = require('../src/Converter');
const packageJson = require('../package.json');

const program = new Command();

program
    .name('epub2md')
    .description('Convert EPUB to Markdown with Obsidian compatibility')
    .version(packageJson.version)
    .argument('<input-file>', 'Path to EPUB file')
    .option('-o, --output <dir>', 'Output directory')
    .option('--no-frontmatter', 'Disable frontmatter generation')
    .action(async (inputFile, options) => {
        try {
            const inputPath = path.resolve(inputFile);

            if (!fs.existsSync(inputPath)) {
                console.error(`Error: File not found: ${inputPath}`);
                process.exit(1);
            }

            // Default output dir to input file's directory if not specified
            // If options.output is undefined, we use input dir.
            const outputDir = options.output ? path.resolve(options.output) : path.dirname(inputPath);

            const converter = new Converter({
                // If --no-frontmatter is passed, options.frontmatter is false.
                // If not passed, options.frontmatter is true (default for negated option in commander? No, undefined usually)
                // Wait, commander documentation says:
                // --no-foo => options.foo = false.
                // If default is not set, what is it?
                // Let's assume we want default true.
                // We pass `noFrontmatter: !options.frontmatter`?
                // If options.frontmatter is undefined -> !undefined = true -> noFrontmatter = true (DISABLES it). WRONG.
                // We want default ENABLED.
                // So noFrontmatter should be false by default.
                // If user passes --no-frontmatter, options.frontmatter is false.
                // We want frontmatter disabled. noFrontmatter = true.

                // Let's rely on explicit check.
                // If user types nothing: options.frontmatter is undefined.
                // We want frontmatter enabled. noFrontmatter = false.

                // If user types --no-frontmatter: options.frontmatter is false.
                // We want frontmatter disabled. noFrontmatter = true.

                noFrontmatter: options.frontmatter === false
            });

            await converter.convert(inputPath, outputDir);
        } catch (error) {
            console.error('Conversion failed:', error.message);
            process.exit(1);
        }
    });

program.parse();
