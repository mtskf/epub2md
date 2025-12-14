/**
 * Generate YAML frontmatter from EPUB metadata.
 * @param {Object} metadata - The EPUB metadata object.
 * @returns {string} The formatted YAML frontmatter string.
 */
function generateFrontmatter(metadata) {
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

module.exports = { generateFrontmatter };
