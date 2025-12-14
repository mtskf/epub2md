const { normalizeHref } = require('../utils/anchors');

module.exports = function (turndownService, { headingTextMap, chapterAnchorMap }) {
    turndownService.addRule('internal-links', {
        filter: 'a',
        replacement: (content, node) => {
            const rawHref = node.getAttribute('href');
            // const id = node.getAttribute('id'); // ID on anchor tag itself is less relevant for Obsidian links unless it's a block anchor.

            if (!rawHref) return content;
            const href = decodeURIComponent(rawHref);

            if (href.startsWith('http') || href.startsWith('mailto:')) {
                return `[${content}](${href})`;
            }

            const hashIndex = href.indexOf('#');
            // Handle in-file anchors: file.html#id or just #id
            if (hashIndex !== -1) {
                const id = href.substring(hashIndex + 1); // Get ID without #
                const headingText = headingTextMap.get(id);
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
            // Logic mirrored from Converter._getChapterAnchorFromHref
            const normalized = normalizeHref(href);
            const chapterAnchor = chapterAnchorMap.get(normalized);

            if (chapterAnchor) {
                const headingText = headingTextMap.get(chapterAnchor);
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
};
