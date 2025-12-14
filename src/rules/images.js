const path = require('path');

module.exports = function (turndownService, { assetsDir, filenameMap }) {
    turndownService.addRule('img', {
        filter: 'img',
        replacement: (content, node) => {
            const alt = node.getAttribute('alt') || '';
            let src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href');
            if (!src) return '';

            const basename = path.basename(src.split('?')[0]);
            const decodedBasename = decodeURIComponent(basename);
            const filename = filenameMap.get(decodedBasename) || decodedBasename;

            // Add newlines to ensure separation from subsequent blocks (like headers)
            return `\n\n![${alt}](${assetsDir}/${filename})\n\n`;
        }
    });

    turndownService.addRule('svg-image', {
        filter: 'image',
        replacement: (content, node) => {
            const alt = node.getAttribute('alt') || '';
            let src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href');
            if (!src) return '';

            const basename = path.basename(src.split('?')[0]);
            const decodedBasename = decodeURIComponent(basename);
            const filename = filenameMap.get(decodedBasename) || decodedBasename;

            return `\n\n![${alt}](${assetsDir}/${filename})\n\n`;
        }
    });
};
