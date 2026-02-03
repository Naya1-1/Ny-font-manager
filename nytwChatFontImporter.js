import { settings } from './nytwState.js';

/* ==========================================================================
   Chat Font Importer Logic
   ========================================================================== */

/** @type {Set<string>} */
const importerLoadedStylesheets = new Set();
const IMPORTER_DEBOUNCE_MS = 120;
const IMPORTER_DEBUG = false;

function importer_normalizeImportUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, '');
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed, location.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.href;
    } catch {
        return null;
    }
}

function importer_extractCssBlocksFromMessageText(text) {
    const cssBlocks = [];
    if (typeof text !== 'string' || !text) return cssBlocks;

    {
        const styleTagRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
        let match;
        while ((match = styleTagRe.exec(text)) !== null) {
            const cssText = (match[1] ?? '').trim();
            if (cssText) cssBlocks.push(cssText);
        }
    }

    {
        const customStyleRe = /<custom-style>([\s\S]*?)<\/custom-style>/gi;
        let match;
        while ((match = customStyleRe.exec(text)) !== null) {
            const encoded = (match[1] ?? '').trim();
            if (!encoded) continue;
            try {
                const decoded = decodeURIComponent(encoded).replaceAll(/<br\/>/g, '').trim();
                if (decoded) cssBlocks.push(decoded);
            } catch { }
        }
    }
    return cssBlocks;
}

function importer_extractImportUrlsFromCss(cssText) {
    if (typeof cssText !== 'string' || !cssText) return [];
    const input = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    const urls = [];
    // eslint-disable-next-line no-useless-escape
    const importRe = /@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]+?))\s*\)|"([^"]+)"|'([^']+)')\s*[^;]*;?/gi;
    let match;
    while ((match = importRe.exec(input)) !== null) {
        const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? '').trim();
        if (raw) urls.push(raw);
    }
    return urls;
}

function importer_collectActiveRegexScripts(ctx) {
    const extSettings = ctx?.extensionSettings;
    if (!extSettings || typeof extSettings !== 'object') return [];

    if (Array.isArray(extSettings.disabledExtensions) && extSettings.disabledExtensions.includes('regex')) {
        return [];
    }

    const scripts = [];
    if (Array.isArray(extSettings.regex)) {
        scripts.push(...extSettings.regex);
    }

    {
        const characterId = ctx?.characterId;
        const characters = ctx?.characters;
        const avatar = (Number.isFinite(Number(characterId)) && Array.isArray(characters))
            ? characters[Number(characterId)]?.avatar
            : null;

        if (avatar && Array.isArray(extSettings.character_allowed_regex) && extSettings.character_allowed_regex.includes(avatar)) {
            const scopedScripts = characters?.[Number(characterId)]?.data?.extensions?.regex_scripts;
            if (Array.isArray(scopedScripts)) {
                scripts.push(...scopedScripts);
            }
        }
    }

    {
        const pm = ctx?.getPresetManager?.();
        const apiId = pm?.apiId ?? null;
        const presetName = typeof pm?.getSelectedPresetName === 'function' ? pm.getSelectedPresetName() : null;
        const allowedMap = extSettings.preset_allowed_regex;
        const allowedPresetsForApi = (apiId && allowedMap && typeof allowedMap === 'object') ? allowedMap[apiId] : null;

        if (apiId && presetName && Array.isArray(allowedPresetsForApi) && allowedPresetsForApi.includes(presetName)) {
            const presetScripts = typeof pm?.readPresetExtensionField === 'function'
                ? pm.readPresetExtensionField({ path: 'regex_scripts' })
                : null;
            if (Array.isArray(presetScripts)) {
                scripts.push(...presetScripts);
            }
        }
    }

    return scripts.filter((script) =>
        script &&
        typeof script === 'object' &&
        script.disabled !== true &&
        typeof script.replaceString === 'string' &&
        script.replaceString.length > 0,
    );
}

function importer_hasStylesheetLink(absoluteHref) {
    const links = document.querySelectorAll('link[rel="stylesheet"][href]');
    for (const link of links) {
        if (!(link instanceof HTMLLinkElement)) continue;
        if (link.href === absoluteHref) return true;
    }
    return false;
}

function importer_ensureStylesheetLoaded(absoluteHref) {
    if (importerLoadedStylesheets.has(absoluteHref)) return false;
    if (importer_hasStylesheetLink(absoluteHref)) {
        importerLoadedStylesheets.add(absoluteHref);
        return false;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = absoluteHref;
    link.dataset.stChatFontImporter = '1';
    document.head.appendChild(link);
    importerLoadedStylesheets.add(absoluteHref);
    return true;
}

function importer_getRenderedMessageIds() {
    const ids = [];
    const messageEls = document.querySelectorAll('#chat .mes[mesid]');
    for (const el of messageEls) {
        const raw = el.getAttribute('mesid');
        if (raw == null) continue;
        const id = Number(raw);
        if (Number.isFinite(id)) ids.push(id);
    }
    return ids;
}

function importer_scanAndLoadImports(reason = 'unknown') {
    // Check main setting toggle
    if (!settings.chatFontImportEnabled) return;

    if (!globalThis.SillyTavern?.getContext) return;
    if (!document.head) return;

    const ctx = SillyTavern.getContext();
    const chat = ctx?.chat;
    if (!Array.isArray(chat)) return;

    const renderedIds = importer_getRenderedMessageIds();
    if (renderedIds.length === 0) return;

    const importsToLoad = new Set();

    try {
        const regexScripts = importer_collectActiveRegexScripts(ctx);
        for (const script of regexScripts) {
            const replaceString = String(script?.replaceString ?? '');
            if (!replaceString) continue;
            if (!replaceString.includes('@import') && !replaceString.toLowerCase().includes('<style') && !replaceString.toLowerCase().includes('<custom-style')) {
                continue;
            }
            const cssBlocks = importer_extractCssBlocksFromMessageText(replaceString);
            for (const cssText of cssBlocks) {
                const rawUrls = importer_extractImportUrlsFromCss(cssText);
                for (const rawUrl of rawUrls) {
                    const normalized = importer_normalizeImportUrl(rawUrl);
                    if (normalized) importsToLoad.add(normalized);
                }
            }
        }
    } catch (err) {
        if (IMPORTER_DEBUG) console.error('[NyTW-Importer] collect regex scripts failed', err);
    }

    for (const id of renderedIds) {
        const message = chat[id];
        if (!message) continue;
        const text = String(message?.extra?.display_text ?? message?.mes ?? '');
        if (!text) continue;
        if (!text.includes('@import') && !text.toLowerCase().includes('<style') && !text.toLowerCase().includes('<custom-style')) {
            continue;
        }
        const cssBlocks = importer_extractCssBlocksFromMessageText(text);
        for (const cssText of cssBlocks) {
            const rawUrls = importer_extractImportUrlsFromCss(cssText);
            for (const rawUrl of rawUrls) {
                const normalized = importer_normalizeImportUrl(rawUrl);
                if (normalized) importsToLoad.add(normalized);
            }
        }
    }

    if (importsToLoad.size === 0) return;
    let inserted = 0;
    for (const href of importsToLoad) {
        if (importer_ensureStylesheetLoaded(href)) inserted++;
    }

    if (IMPORTER_DEBUG && inserted > 0) {
        console.debug(`[NyTW-Importer] inserted=${inserted} totalImports=${importsToLoad.size} reason=${reason}`);
    }
}

let importerScanTimer = null;
function importer_scheduleScan(reason) {
    if (importerScanTimer) clearTimeout(importerScanTimer);
    importerScanTimer = setTimeout(() => {
        importerScanTimer = null;
        try {
            importer_scanAndLoadImports(reason);
        } catch (err) {
            if (IMPORTER_DEBUG) console.error('[NyTW-Importer] scan failed', err);
        }
    }, IMPORTER_DEBOUNCE_MS);
}

function initChatFontImporter() {
    if (!globalThis.SillyTavern?.getContext) return;
    const { eventSource, event_types } = SillyTavern.getContext();
    if (!eventSource?.on || !event_types) return;

    eventSource.on(event_types.APP_READY, () => importer_scheduleScan('APP_READY'));
    eventSource.on(event_types.CHAT_CHANGED, () => importer_scheduleScan('CHAT_CHANGED'));
    eventSource.on(event_types.MORE_MESSAGES_LOADED, () => importer_scheduleScan('MORE_MESSAGES_LOADED'));
    eventSource.on(event_types.SETTINGS_UPDATED, () => importer_scheduleScan('SETTINGS_UPDATED'));
    eventSource.on(event_types.PRESET_CHANGED, () => importer_scheduleScan('PRESET_CHANGED'));
    eventSource.on(event_types.MAIN_API_CHANGED, () => importer_scheduleScan('MAIN_API_CHANGED'));
    eventSource.on(event_types.MESSAGE_UPDATED, () => importer_scheduleScan('MESSAGE_UPDATED'));
    eventSource.on(event_types.MESSAGE_EDITED, () => importer_scheduleScan('MESSAGE_EDITED'));
    eventSource.on(event_types.USER_MESSAGE_RENDERED, () => importer_scheduleScan('USER_MESSAGE_RENDERED'));
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => importer_scheduleScan('CHARACTER_MESSAGE_RENDERED'));

    // Allow manual trigger
    globalThis.nytwChatFontImporterRescan = () => importer_scheduleScan('manual');
    importer_scheduleScan('init');
}



export { importer_scheduleScan, initChatFontImporter };
