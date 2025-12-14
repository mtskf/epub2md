const path = require('path');

function normalizeHref(href) {
    if (!href) return '';
    const withoutFragment = href.split('#')[0];
    const withoutQuery = withoutFragment.split('?')[0];
    const decoded = decodeURIComponent(withoutQuery);
    return path.basename(decoded);
}

function slugifyAnchor(raw) {
    if (!raw) return '';
    const withoutExt = raw.replace(/\.x?html?$/i, '');
    const slug = withoutExt.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || '';
}

module.exports = {
    normalizeHref,
    slugifyAnchor
};
