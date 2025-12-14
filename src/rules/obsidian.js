module.exports = function (turndownService, { headingTextMap }) {
    // Add rule to append ^block-id to block elements with ID
    turndownService.addRule('obsidian-ids', {
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
                    headingTextMap.set(id, content);
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
};
