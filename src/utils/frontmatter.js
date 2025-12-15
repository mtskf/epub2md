/**
 * Generate YAML frontmatter from EPUB metadata.
 * @param {string} [coverImage] - Path to the cover image.
 * @returns {string} The formatted YAML frontmatter string.
 */
function generateFrontmatter(metadata, coverImage) {
    if (!metadata) return '';
    const lines = ['---'];
    if (metadata.title) lines.push(`title: "${metadata.title.replace(/"/g, '\\"')}"`);
    if (metadata.creator) lines.push(`author: "${metadata.creator.replace(/"/g, '\\"')}"`);
    if (metadata.publisher) lines.push(`publisher: "${metadata.publisher.replace(/"/g, '\\"')}"`);
    if (metadata.language) lines.push(`language: "${metadata.language}"`);
    if (metadata.date) lines.push(`date: "${metadata.date}"`);
    if (coverImage) lines.push(`cover: "${coverImage}"`);
    lines.push('read: false');
    lines.push('rating: ');
    lines.push('tags: [converted-from-epub, book]');
    lines.push('---');
    lines.push('');
    return lines.join('\n') + '\n';
}

module.exports = { generateFrontmatter };
