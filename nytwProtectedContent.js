// Markdown tables rely on browser table layout and the stable HTML structure
// emitted by the Markdown renderer. Character-level locale/stream/typewriter
// spans can destabilize columns, so table internals are protected structured
// content along with script/style/code-like regions. During live rendering,
// SillyTavern may also expose raw pipe-table Markdown before it becomes a
// <table>; that source must stay contiguous so the Markdown renderer can parse it.
export const NYTW_PROTECTED_CONTENT_SELECTOR = 'style, script, textarea, pre, code, table, thead, tbody, tfoot, tr, th, td, caption';

export function isWithinNytwProtectedContent(el) {
    return Boolean(el?.closest?.(NYTW_PROTECTED_CONTENT_SELECTOR));
}

export function isNytwProtectedContentElement(el) {
    return Boolean(el?.matches?.(NYTW_PROTECTED_CONTENT_SELECTOR));
}

function splitMarkdownTableCells(line) {
    let raw = String(line || '').trim();
    if (!raw.includes('|')) return [];
    if (raw.startsWith('|')) raw = raw.slice(1);
    if (raw.endsWith('|')) raw = raw.slice(0, -1);
    return raw.split('|').map((cell) => cell.trim());
}

function isMarkdownTableRowLine(line) {
    const cells = splitMarkdownTableCells(line);
    return cells.length >= 2 && cells.some((cell) => cell.length > 0);
}

function isMarkdownTableSeparatorLine(line) {
    const cells = splitMarkdownTableCells(line);
    return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

export function isLikelyNytwMarkdownTableSource(text) {
    const lines = String(text || '').split(/\r?\n/);
    if (lines.length < 2) return false;

    for (let i = 1; i < lines.length; i += 1) {
        if (!isMarkdownTableSeparatorLine(lines[i])) continue;
        if (isMarkdownTableRowLine(lines[i - 1])) return true;
    }

    return false;
}
