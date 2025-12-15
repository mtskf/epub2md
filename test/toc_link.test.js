const Converter = require('../src/Converter');

describe('TOC Link Regression Test', () => {
    test('should extract heading text from IDs nested within heading elements', async () => {
        const converter = new Converter();

        // Mock EPUB object
        const epub = {
            flow: [
                { id: 'chapter1', href: 'chapter1.html' }
            ]
        };

        // Problematic HTML structure: ID on an anchor inside a span inside an h1
        const problematicHtml = `
            <div id="_idContainer004">
                <h1 id="_idParaDest-1" class="scribe_chapter-title">
                    <span class="scribe_running-header-text">
                        <a id="_idTextAnchor000"/>Important Notes On This Book (Disclaimer)
                    </span>
                </h1>
                <p>Some content...</p>
            </div>
        `;

        // Mock getChapterText
        converter.getChapterText = jest.fn().mockResolvedValue(problematicHtml);

        // We also need to mock _getChapterAnchor / _ensureChapterAnchor behavior or just let them run?
        // _preindexHeadingText calls these.
        // It's safer to use the real methods but we need to ensure they don't crash on mocked epub.
        // _ensureChapterAnchor just parses text, should be fine.

        await converter._preindexHeadingText(epub);

        // Verify the map processing
        expect(converter.headingTextMap.get('_idTextAnchor000')).toBe('Important Notes On This Book (Disclaimer)');

        // Optional: Check the H1 ID itself too
        expect(converter.headingTextMap.get('_idParaDest-1')).toBe('Important Notes On This Book (Disclaimer)');
    });

    test('should extract simplified text from IDs inside complex nested structures', async () => {
        const converter = new Converter();
        const epub = { flow: [{ id: 'c1', href: 'c1.html' }] };
        const html = `
            <h2>
                <span id="nested-span">
                    <a id="deep-anchor"></a>
                    Chapter <strong>Two</strong>
                </span>
            </h2>
        `;
        converter.getChapterText = jest.fn().mockResolvedValue(html);
        await converter._preindexHeadingText(epub);

        expect(converter.headingTextMap.get('nested-span')).toBe('Chapter Two');
        expect(converter.headingTextMap.get('deep-anchor')).toBe('Chapter Two');
    });
});
