﻿import { eventSource, event_types, streamingProcessor } from '../../../../script.js';
import { applyCustomIndependentFont, CUSTOM_INDEPENDENT_FONT_CLASS, CUSTOM_INDEPENDENT_FONT_MARK_ATTR } from './customIndependentFont.js';
import { morphdom } from '../../../../lib.js';
import { clampOptionalFontSize, clampOptionalLetterSpacing, clampStreamAnimSpeed, getStreamRenderMode, normalizeStreamAnimEffect, settings } from './nytwState.js';
import { LOCALE_KEY_PRIORITY, UNICODE_RANGES } from './nytwLocaleData.js';
import {
    buildFontFaceCssForFamilies,
    collectExternalFontCssUrlsForFamilies,
    cssQuote,
    ensureFontStyleElement,
    parseFontFamilyList,
    revokeAllFontObjectUrls,
    syncExternalFontStylesheets,
    toCssFontFamilyValue,
} from './nytwFonts.js';

const TYPEWRITER_SELECTOR = '.custom-Ny-font-manager, .Ny-font-manager';
const PROCESSED_ATTR = 'data-ny-tw-processed';
const COUNT_ATTR = 'data-ny-tw-count';
const CHAR_CLASS = 'ny-tw-char custom-ny-tw-char';
const BUNDLE_SELECTOR = "[data-ny-bundle='1']";
const BUNDLE_PROCESSED_ATTR = 'data-ny-bundle-processed';
const STREAMING_MESSAGE_CLASS = 'nytw-streaming';
const STREAM_RENDER_ATTR = 'data-nytw-stream-render';
const STREAM_BUFFER_CLASS = 'nytw-stream-buffer';
const STREAM_ANIM_ATTR = 'data-nytw-stream-anim';
const STREAM_CURSOR_ATTR = 'data-nytw-stream-cursor';
const STREAM_SEG_CLASS = 'nytw-stream-seg';
const STREAM_SEG_NEW_ATTR = 'data-nytw-stream-new';
const STREAM_SEG_BR_ATTR = 'data-nytw-stream-br';
const STREAM_SEG_WS_ATTR = 'data-nytw-stream-ws';
const STREAM_CURSOR_CLASS = 'nytw-stream-cursor';
const STREAM_BLOCK_HIDDEN_ATTR = 'data-nytw-stream-block-hidden';
const STREAM_SEG_COUNT_DATA = 'nytwStreamSegCount';
const STREAM_SHOWN_COUNT_DATA = 'nytwStreamShownCount';
const STREAM_STEP_VAR = '--nytw-stream-step';

const LOCALE_FONT_ATTR = 'data-nytw-locale-font';
const LOCALE_WRAP_ATTR = 'data-nytw-locale-wrap';

const DIALOGUE_QUOTE_PAIRS = [
    ['"', '"'],
    ['\u201C', '\u201D'], // “ ”
    ['\uFF02', '\uFF02'], // ＂ ＂
    ['\'', '\''],
    ['\u2018', '\u2019'], // ‘ ’
    ['\uFF07', '\uFF07'], // ＇ ＇
];

const dialogueFontProcessSig = new WeakMap();
const localeFontProcessSig = new WeakMap();
const streamTypewriterTimers = new WeakMap();

const graphemeSegmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

const streamAnimSegmenters = new Map();
function getStreamAnimSegmenter(granularity) {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
    const key = String(granularity || 'word');
    if (streamAnimSegmenters.has(key)) return streamAnimSegmenters.get(key);
    const seg = new Intl.Segmenter(undefined, { granularity: key });
    streamAnimSegmenters.set(key, seg);
    return seg;
}

function getActiveStreamingMessageId() {
    const sp = streamingProcessor;
    const isActive = Boolean(sp && !sp.isFinished && !sp.isStopped);
    return isActive && Number.isFinite(Number(sp.messageId)) ? String(sp.messageId) : null;
}


let applyFontsQueue = Promise.resolve();
function queueApplyFonts() {
    applyFontsQueue = applyFontsQueue
        .then(applyFontSettings)
        .catch((error) => console.error('[NyTW] Failed to apply fonts', error));
}

function setOrRemoveCssVar(el, name, value) {
    if (!el || !(el instanceof HTMLElement)) return;
    const raw = String(value ?? '').trim();
    if (!raw) {
        el.style.removeProperty(name);
        return;
    }
    el.style.setProperty(name, raw);
}

function clearTypographyVariables(chatEl) {
    if (!chatEl || !(chatEl instanceof HTMLElement)) return;

    chatEl.style.removeProperty('--nytw-body-font-size');
    chatEl.style.removeProperty('--nytw-body-letter-spacing');
    chatEl.style.removeProperty('--nytw-dialogue-font-size');
    chatEl.style.removeProperty('--nytw-dialogue-letter-spacing');
    chatEl.style.removeProperty('--nytw-custom-font-size');
    chatEl.style.removeProperty('--nytw-custom-letter-spacing');
    chatEl.style.removeProperty('--nytw-locale-font-size');
    chatEl.style.removeProperty('--nytw-locale-letter-spacing');
}

function applyTypographyVariables() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;

    if (!settings.fontsEnabled) {
        clearTypographyVariables(chatEl);
        return;
    }

    const bodyFontSize = clampOptionalFontSize(settings.bodyFontSize);
    const bodyLetterSpacing = clampOptionalLetterSpacing(settings.bodyLetterSpacing);
    const dialogueFontSize = clampOptionalFontSize(settings.dialogueFontSize);
    const dialogueLetterSpacing = clampOptionalLetterSpacing(settings.dialogueLetterSpacing);
    const customFontSize = clampOptionalFontSize(settings.customFontSize);
    const customLetterSpacing = clampOptionalLetterSpacing(settings.customLetterSpacing);
    const localeFontSize = clampOptionalFontSize(settings.localeFontSize);
    const localeLetterSpacing = clampOptionalLetterSpacing(settings.localeLetterSpacing);

    setOrRemoveCssVar(chatEl, '--nytw-body-font-size', bodyFontSize === null ? '' : `${bodyFontSize}px`);
    setOrRemoveCssVar(chatEl, '--nytw-body-letter-spacing', bodyLetterSpacing === null ? '' : `${bodyLetterSpacing}em`);
    setOrRemoveCssVar(chatEl, '--nytw-dialogue-font-size', dialogueFontSize === null ? '' : `${dialogueFontSize}px`);
    setOrRemoveCssVar(chatEl, '--nytw-dialogue-letter-spacing', dialogueLetterSpacing === null ? '' : `${dialogueLetterSpacing}em`);
    setOrRemoveCssVar(chatEl, '--nytw-custom-font-size', customFontSize === null ? '' : `${customFontSize}px`);
    setOrRemoveCssVar(chatEl, '--nytw-custom-letter-spacing', customLetterSpacing === null ? '' : `${customLetterSpacing}em`);
    setOrRemoveCssVar(chatEl, '--nytw-locale-font-size', localeFontSize === null ? '' : `${localeFontSize}px`);
    setOrRemoveCssVar(chatEl, '--nytw-locale-letter-spacing', localeLetterSpacing === null ? '' : `${localeLetterSpacing}em`);
}

async function applyFontSettings() {
    const styleEl = ensureFontStyleElement();
    if (!settings.fontsEnabled) {
        styleEl.textContent = '';
        revokeAllFontObjectUrls();
        syncExternalFontStylesheets([]);
        applyTypographyVariables();
        return;
    }

    const bodyFontCss = toCssFontFamilyValue(settings.bodyFont);
    const dialogueFontCss = toCssFontFamilyValue(settings.dialogueFont);
    const customFontCss = toCssFontFamilyValue(settings.customFont);
    const localeFontMap = getActiveLocaleFontMap();

    // Collect all families including locale overrides
    const localeFontNames = [];
    for (const font of localeFontMap.values()) {
        localeFontNames.push(...parseFontFamilyList(font));
    }

    const families = [
        ...parseFontFamilyList(bodyFontCss),
        ...parseFontFamilyList(dialogueFontCss),
        ...parseFontFamilyList(customFontCss),
        ...localeFontNames,
    ];

    syncExternalFontStylesheets(collectExternalFontCssUrlsForFamilies(families));

    let css = '/* NyTW Fonts (generated) */\n';
    try {
        css += await buildFontFaceCssForFamilies(families);
    } catch (error) {
        console.error('[NyTW] Failed to build @font-face rules', error);
    }

    if (bodyFontCss) {
        css += `\n#chat .mes_text{font-family:${bodyFontCss} !important;}`;
    }

    if (localeFontMap.size) {
        css += '\n/* Locale Font Overrides */\n';
        for (const [key, fontCss] of localeFontMap.entries()) {
            css += `#chat .mes_text [${LOCALE_FONT_ATTR}=${cssQuote(key)}]{font-family:${fontCss};}\n`;
        }
    }

    if (dialogueFontCss) {
        css += [
            '\n#chat .mes_text .Ny-font-manager,',
            '#chat .mes_text .custom-Ny-font-manager,',
            '#chat .mes_text .ny-dialogue,',
            '#chat .mes_text .custom-ny-dialogue',
            `{font-family:${dialogueFontCss} !important;}`,
        ].join('');
    }

    if (customFontCss) {
        const customClass = CUSTOM_INDEPENDENT_FONT_CLASS;
        const customScopedClass = `custom-${CUSTOM_INDEPENDENT_FONT_CLASS}`;
        css += [
            `\n#chat .mes_text .${customClass},`,
            `#chat .mes_text .${customScopedClass}`,
            `{font-family:${customFontCss} !important;}`,
        ].join('');
    }

    css += '\n/* Typography overrides (font-size / letter-spacing) */\n';
    css += '\n#chat .mes_text{font-size:var(--nytw-body-font-size) !important;letter-spacing:var(--nytw-body-letter-spacing) !important;}';
    css += `\n#chat .mes_text [${LOCALE_FONT_ATTR}]{font-size:var(--nytw-locale-font-size) !important;letter-spacing:var(--nytw-locale-letter-spacing) !important;}`;
    css += [
        '\n#chat .mes_text .Ny-font-manager,',
        '#chat .mes_text .custom-Ny-font-manager,',
        '#chat .mes_text .ny-dialogue,',
        '#chat .mes_text .custom-ny-dialogue',
        '{font-size:var(--nytw-dialogue-font-size) !important;letter-spacing:var(--nytw-dialogue-letter-spacing) !important;}',
    ].join('');
    css += `\n#chat .mes_text .${CUSTOM_INDEPENDENT_FONT_CLASS},#chat .mes_text .custom-${CUSTOM_INDEPENDENT_FONT_CLASS}{font-size:var(--nytw-custom-font-size) !important;letter-spacing:var(--nytw-custom-letter-spacing) !important;}`;

    css += [
        '\n/* Streaming: disable NyTW animations to avoid flicker while SillyTavern re-renders .mes_text */',
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS} .mes_text{white-space:normal !important;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS} .ny-tw-char,`,
        `#chat .mes.${STREAMING_MESSAGE_CLASS} .custom-ny-tw-char`,
        '{animation:none !important;opacity:1 !important;}',
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS} [class*="ny-dialogue-inner-"],`,
        `#chat .mes.${STREAMING_MESSAGE_CLASS} [class*="ny-custom-inner-"]`,
        '{animation:none !important;filter:none !important;opacity:1 !important;transform:none !important;}',
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS} [class*="ny-dialogue-"],`,
        `#chat .mes.${STREAMING_MESSAGE_CLASS} [class*="ny-custom-"]`,
        '{animation:none !important;}',
        '\n/* Streaming render mode: buffered live view */',
        `\n#chat .mes_text.${STREAM_BUFFER_CLASS}{display:none !important;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"] .mes_text:not(.${STREAM_BUFFER_CLASS}){display:none !important;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"] .mes_text.${STREAM_BUFFER_CLASS}{display:block !important;height:auto !important;min-height:0 !important;white-space:normal !important;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"] .mes_text.${STREAM_BUFFER_CLASS} p{margin-top:var(--nytw-stream-p-mt,0);margin-bottom:var(--nytw-stream-p-mb,10px);}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"] .mes_text.${STREAM_BUFFER_CLASS} p:last-child{margin-bottom:var(--nytw-stream-p-mb-last,0);}`,
        '\n/* Streaming animations (NyTW) */',
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}{display:inline-block;vertical-align:baseline;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}[${STREAM_SEG_BR_ATTR}="1"]{display:inline !important;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}[${STREAM_SEG_WS_ATTR}="1"]{display:inline !important;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}="typewriter"] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]{opacity:0;animation:nytw-stream-tw-in 160ms cubic-bezier(.18,.89,.32,1.05) both;animation-delay:calc(var(--nytw-stream-i, 0) * var(${STREAM_STEP_VAR}, 20ms));}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}="blur"] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]{opacity:0;filter:blur(10px);animation:nytw-stream-blur-in 320ms cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--nytw-stream-i, 0) * 12ms);}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}="glow"] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]{opacity:0;text-shadow:0 0 0 rgba(120,180,255,.0);animation:nytw-stream-glow-in 420ms cubic-bezier(.18,.89,.32,1.05) both;animation-delay:calc(var(--nytw-stream-i, 0) * 10ms);}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_CURSOR_ATTR}="1"] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_CURSOR_CLASS}{display:inline-block;position:relative;width:0;height:1em;vertical-align:-0.1em;pointer-events:none;}`,
        `\n#chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_CURSOR_ATTR}="1"] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_CURSOR_CLASS}::after{content:"";position:absolute;left:0;top:0.1em;bottom:0.1em;width:2px;background:currentColor;opacity:.9;animation:nytw-stream-caret 1s steps(1,end) infinite;}`,
        '\n@keyframes nytw-stream-tw-in{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:none;}}',
        '\n@keyframes nytw-stream-blur-in{0%{opacity:0;filter:blur(10px);}100%{opacity:1;filter:blur(0);}}',
        '\n@keyframes nytw-stream-glow-in{0%{opacity:0;transform:translateY(3px);text-shadow:0 0 0 rgba(120,180,255,.0);}55%{opacity:1;text-shadow:0 0 12px rgba(120,180,255,.55);}100%{opacity:1;transform:none;text-shadow:0 0 0 rgba(120,180,255,.0);}}',
        '\n@keyframes nytw-stream-caret{0%,49%{opacity:1;}50%,100%{opacity:0;}}',
        '\n@media (prefers-reduced-motion: reduce){',
        `\n  #chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_ANIM_ATTR}] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]{animation:none !important;opacity:1 !important;filter:none !important;transform:none !important;text-shadow:none !important;}`,
        `\n  #chat .mes.${STREAMING_MESSAGE_CLASS}[${STREAM_RENDER_ATTR}="buffer"][${STREAM_CURSOR_ATTR}="1"] .mes_text.${STREAM_BUFFER_CLASS} .${STREAM_CURSOR_CLASS}::after{animation:none !important;opacity:0 !important;}`,
        '\n}',
        '\n',
    ].join('');

    styleEl.textContent = css;
    applyTypographyVariables();
}

function stripStreamingBufferWhitespace(rootEl) {
    if (!rootEl || !(rootEl instanceof HTMLElement)) return;
    const childNodes = Array.from(rootEl.childNodes);
    for (const node of childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const raw = node.nodeValue || '';
        if (!/[\r\n]/.test(raw)) continue;
        if (!/^[\s\u200B\u200C\u200D\uFEFF]*$/.test(raw)) continue;
        node.parentNode?.removeChild(node);
    }
}

function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(String(value ?? ''));
    } catch {
        return String(value ?? '');
    }
}

function buildScopedClassNames(...classNames) {
    const resolved = [];
    for (const className of classNames) {
        const base = String(className || '').trim();
        if (!base) continue;
        resolved.push(base);
        if (!base.startsWith('custom-')) {
            resolved.push(`custom-${base}`);
        }
    }
    return resolved.join(' ');
}

function applyQuoteWrapping(rootEl) {
    if (!rootEl) return;

    const quotePairs = [
        ['"', '"'],
        ['\u201C', '\u201D'], // “ ”
        ['\u2018', '\u2019'], // ‘ ’
        ['\u00AB', '\u00BB'], // « »
        ['\u300C', '\u300D'], // 「 」
        ['\uFF02', '\uFF02'], // ＂ ＂
        ['\uFF07', '\uFF07'], // ＇ ＇
        ['\'', '\''],
    ];

    const isAsciiWordChar = (ch) => /[0-9A-Za-z]/.test(String(ch || ''));
    const isApostropheLike = (token) => token === '\'' || token === '\u2019' || token === '\uFF07';
    const isApostropheInWord = (text, tokenIdx, token) => {
        const prev = tokenIdx > 0 ? text[tokenIdx - 1] : '';
        const nextIdx = tokenIdx + token.length;
        const next = nextIdx < text.length ? text[nextIdx] : '';
        return isAsciiWordChar(prev) && isAsciiWordChar(next);
    };

    const findNextValidToken = (text, token, fromIdx) => {
        let candidate = text.indexOf(token, fromIdx);
        if (!isApostropheLike(token)) return candidate;
        while (candidate !== -1 && isApostropheInWord(text, candidate, token)) {
            candidate = text.indexOf(token, candidate + token.length);
        }
        return candidate;
    };

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
            const text = node.nodeValue;
            if (!quotePairs.some(([open]) => text.includes(open))) return NodeFilter.FILTER_REJECT;

            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest('style, script, textarea, pre, code, q')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const textNodes = [];
    let n = walker.nextNode();
    while (n) {
        textNodes.push(/** @type {Text} */ (n));
        n = walker.nextNode();
    }

    for (const textNode of textNodes) {
        const text = textNode.nodeValue || '';
        if (!quotePairs.some(([open]) => text.includes(open))) continue;

        const frag = document.createDocumentFragment();
        let idx = 0;
        let changed = false;

        while (idx < text.length) {
            let openIdx = -1;
            let openToken = '';
            let closeToken = '';
            for (const [open, close] of quotePairs) {
                const candidateIdx = findNextValidToken(text, open, idx);
                if (candidateIdx === -1) continue;
                if (openIdx === -1 || candidateIdx < openIdx) {
                    openIdx = candidateIdx;
                    openToken = open;
                    closeToken = close;
                }
            }

            if (openIdx === -1) break;

            if (openIdx > idx) {
                frag.appendChild(document.createTextNode(text.slice(idx, openIdx)));
            }

            const openEnd = openIdx + openToken.length;
            const closeIdx = findNextValidToken(text, closeToken, openEnd);
            if (closeIdx === -1) {
                frag.appendChild(document.createTextNode(openToken));
                idx = openEnd;
                continue;
            }

            const q = document.createElement('q');
            // Preserve the original quote characters inside <q> (SillyTavern disables q::before/q::after).
            q.textContent = `${openToken}${text.slice(openEnd, closeIdx)}${closeToken}`;
            frag.appendChild(q);
            changed = true;

            idx = closeIdx + closeToken.length;
        }

        if (!changed) continue;
        if (idx < text.length) {
            frag.appendChild(document.createTextNode(text.slice(idx)));
        }

        textNode.parentNode?.replaceChild(frag, textNode);
    }
}

function getDialogueFontContainerSignature(containerEl) {
    const textLen = (containerEl?.textContent || '').length;
    const qCount = containerEl?.querySelectorAll ? containerEl.querySelectorAll('q').length : 0;
    const markedQCount = containerEl?.querySelectorAll
        ? containerEl.querySelectorAll('q.ny-dialogue, q.custom-ny-dialogue').length
        : 0;
    return `${textLen}:${qCount}:${markedQCount}`;
}

function applyDialogueFontToQuotes(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) return;
    if (!settings.fontsEnabled) return;
    if (!String(settings.dialogueFont || '').trim()) return;

    const prevSig = dialogueFontProcessSig.get(containerEl);
    const sig = getDialogueFontContainerSignature(containerEl);
    if (prevSig === sig) return;

    const rawText = containerEl.textContent || '';
    const hasPotentialDialogueQuotes = rawText && DIALOGUE_QUOTE_PAIRS.some(([open]) => rawText.includes(open));
    const hasQ = Boolean(containerEl.querySelector('q'));
    if (!hasPotentialDialogueQuotes && !hasQ) {
        dialogueFontProcessSig.set(containerEl, sig);
        return;
    }

    applyQuoteWrapping(containerEl);

    const qEls = Array.from(containerEl.querySelectorAll('q'));
    for (const q of qEls) {
        if (!(q instanceof HTMLElement)) continue;

        if (q.closest('.ny-custom, .custom-ny-custom')) {
            q.classList.remove('ny-dialogue', 'custom-ny-dialogue');
            continue;
        }

        // Already wrapped/marked by bundle scripts.
        if (q.closest('.ny-dialogue, .custom-ny-dialogue')) continue;

        const qText = (q.textContent || '').trim();
        const isDialogueQ = DIALOGUE_QUOTE_PAIRS.some(([open, close]) => (
            qText.startsWith(open)
            && qText.endsWith(close)
            && qText.length >= (open.length + close.length)
        ));
        if (!isDialogueQ) continue;

        q.classList.add('ny-dialogue', 'custom-ny-dialogue');
        q.removeAttribute('data-ny-q-plain');
    }

    dialogueFontProcessSig.set(containerEl, getDialogueFontContainerSignature(containerEl));
}

function getActiveLocaleFontMap() {
    const map = new Map();
    if (!settings.fontsEnabled) return map;
    if (!settings.localeFontEnabled) return map;
    if (!Array.isArray(settings.localeFonts)) return map;

    for (const rule of settings.localeFonts) {
        const key = String(rule?.rangeKey || '').trim();
        if (!key || !UNICODE_RANGES[key]) continue;
        const fontCss = toCssFontFamilyValue(rule?.font);
        if (!fontCss) continue;
        map.set(key, fontCss);
    }

    return map;
}

function unwrapLocaleWrapper(el) {
    const parent = el?.parentNode;
    if (!parent) return;
    const frag = document.createDocumentFragment();
    while (el.firstChild) frag.appendChild(el.firstChild);
    parent.replaceChild(frag, el);
}

function clearLocaleFontProcessing(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) return;

    // Unwrap our own wrappers first.
    const wrappers = Array.from(containerEl.querySelectorAll(`[${LOCALE_WRAP_ATTR}]`));
    for (const el of wrappers) {
        if (!(el instanceof HTMLElement)) continue;
        unwrapLocaleWrapper(el);
    }

    // Clear marks on existing elements (e.g. .ny-tw-char spans).
    const marked = Array.from(containerEl.querySelectorAll(`[${LOCALE_FONT_ATTR}]`));
    for (const el of marked) {
        if (!(el instanceof HTMLElement)) continue;
        el.removeAttribute(LOCALE_FONT_ATTR);
    }
}

function getLocaleFontContainerSignature(containerEl, rulesSig) {
    const textLen = (containerEl?.textContent || '').length;
    const hasWrap = containerEl?.querySelector ? (containerEl.querySelector(`[${LOCALE_WRAP_ATTR}]`) ? 1 : 0) : 0;
    const hasMark = containerEl?.querySelector ? (containerEl.querySelector(`[${LOCALE_FONT_ATTR}]`) ? 1 : 0) : 0;
    const sig = String(rulesSig || '');
    return `${sig}:${textLen}:${hasWrap}:${hasMark}`;
}

function codePointInRanges(codePoint, ranges) {
    if (!Number.isFinite(codePoint) || !ranges?.length) return false;
    for (const [start, end] of ranges) {
        if (codePoint >= start && codePoint <= end) return true;
    }
    return false;
}

function isCombiningOrVariationCodePoint(codePoint) {
    // Combining Diacritical Marks + a few common variation/ZWJ ranges.
    return (
        (codePoint >= 0x0300 && codePoint <= 0x036F)
        || (codePoint >= 0x1AB0 && codePoint <= 0x1AFF)
        || (codePoint >= 0x1DC0 && codePoint <= 0x1DFF)
        || (codePoint >= 0x20D0 && codePoint <= 0x20FF)
        || (codePoint >= 0xFE20 && codePoint <= 0xFE2F)
        || (codePoint >= 0xFE00 && codePoint <= 0xFE0F) // Variation Selectors
        || (codePoint >= 0xE0100 && codePoint <= 0xE01EF) // Variation Selectors Supplement
        || codePoint === 0x200D // ZWJ
    );
}

function getFirstSignificantCodePoint(grapheme) {
    const raw = String(grapheme || '');
    if (!raw) return null;

    for (const ch of Array.from(raw)) {
        const cp = ch.codePointAt(0);
        if (!Number.isFinite(cp)) continue;
        if (isCombiningOrVariationCodePoint(cp)) continue;
        return cp;
    }

    return null;
}

function iterateTextSegmentsWithIndices(text, onSegment) {
    const raw = String(text || '');
    if (!raw) return;

    if (graphemeSegmenter) {
        for (const part of graphemeSegmenter.segment(raw)) {
            onSegment(part.segment, part.index, part.index + part.segment.length);
        }
        return;
    }

    // Fallback: code point iteration (keeps surrogate pairs intact).
    let idx = 0;
    for (const segment of Array.from(raw)) {
        const start = idx;
        idx += segment.length;
        onSegment(segment, start, idx);
    }
}

function getLocaleKeyForSegment(segment, activeKeys, prevKey) {
    const text = String(segment || '');
    if (!text) return prevKey || '';

    // Whitespace-only segments should follow the previous key to avoid fragmentation.
    if (!text.trim().length) return prevKey || '';

    const cp = getFirstSignificantCodePoint(text);
    if (cp === null) return prevKey || '';

    // Digits / punctuation / emoji are treated as "neutral" unless explicitly configured,
    // in which case they can be split and assigned their own font.
    if (codePointInRanges(cp, UNICODE_RANGES.digits?.ranges)) {
        return activeKeys.has('digits') ? 'digits' : (prevKey || '');
    }
    if (codePointInRanges(cp, UNICODE_RANGES.punctuation?.ranges)) {
        return activeKeys.has('punctuation') ? 'punctuation' : (prevKey || '');
    }
    if (codePointInRanges(cp, UNICODE_RANGES.emoji?.ranges)) {
        return activeKeys.has('emoji') ? 'emoji' : (prevKey || '');
    }

    for (const key of LOCALE_KEY_PRIORITY) {
        if (!activeKeys.has(key)) continue;
        const def = UNICODE_RANGES[key];
        if (!def?.ranges) continue;
        if (codePointInRanges(cp, def.ranges)) return key;
    }

    return '';
}

function buildLocaleWrapSegments(text, activeKeys, initialPrevKey) {
    const raw = String(text || '');
    if (!raw) return { segments: [], lastKey: initialPrevKey || '' };

    /** @type {Array<[number, number, string]>} */
    const segments = [];

    let prevKey = initialPrevKey || '';
    let runKey = null;
    let runStart = 0;

    iterateTextSegmentsWithIndices(raw, (seg, start) => {
        const key = getLocaleKeyForSegment(seg, activeKeys, prevKey);

        if (runKey === null) {
            runKey = key;
            runStart = start;
        } else if (key !== runKey) {
            if (runKey) segments.push([runStart, start, runKey]);
            runKey = key;
            runStart = start;
        }

        prevKey = key;
    });

    if (runKey && runStart < raw.length) {
        segments.push([runStart, raw.length, runKey]);
    }

    return { segments, lastKey: prevKey };
}

function wrapTextNodeRangeWithLocale(textNode, startOffset, endOffset, key) {
    if (!textNode?.parentNode) return;
    const value = textNode.nodeValue || '';
    if (!value) return;

    const start = Math.max(0, Math.min(value.length, startOffset));
    const end = Math.max(0, Math.min(value.length, endOffset));
    if (end <= start) return;

    /** @type {Text} */
    let middle = textNode;
    if (start > 0) middle = middle.splitText(start);

    const middleValue = middle.nodeValue || '';
    const middleLen = middleValue.length;
    const desiredLen = Math.min(middleLen, end - start);
    if (desiredLen < middleLen) middle.splitText(desiredLen);

    const wrapper = document.createElement('span');
    wrapper.setAttribute(LOCALE_WRAP_ATTR, '1');
    wrapper.setAttribute(LOCALE_FONT_ATTR, key);
    middle.parentNode.replaceChild(wrapper, middle);
    wrapper.appendChild(middle);
}

function collectEligibleLocaleTextNodes(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) return [];

    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest('style, script, textarea, pre, code')) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`.${CUSTOM_INDEPENDENT_FONT_CLASS}, .custom-${CUSTOM_INDEPENDENT_FONT_CLASS}`)) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`[${CUSTOM_INDEPENDENT_FONT_MARK_ATTR}]`)) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`.${CHAR_CLASS.split(' ')[0]}`)) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`[${LOCALE_WRAP_ATTR}]`)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const nodes = [];
    let n = walker.nextNode();
    while (n) {
        nodes.push(/** @type {Text} */ (n));
        n = walker.nextNode();
        if (nodes.length >= 20000) break;
    }
    return nodes;
}

function applyLocaleFontsToTextNodes(containerEl, activeKeys) {
    const textNodes = collectEligibleLocaleTextNodes(containerEl);
    if (!textNodes.length) return;

    let carryKey = '';
    let totalWraps = 0;

    for (const node of textNodes) {
        const text = node.nodeValue || '';
        if (!text) continue;

        const { segments, lastKey } = buildLocaleWrapSegments(text, activeKeys, carryKey);
        carryKey = lastKey;
        if (!segments.length) continue;

        // Process from the end so splitText offsets remain valid.
        const sorted = segments
            .map(([s, e, k]) => [Number(s) || 0, Number(e) || 0, String(k || '')])
            .filter(([s, e, k]) => k && e > s)
            .sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));

        for (const [start, end, key] of sorted) {
            if (totalWraps >= 12000) return;
            wrapTextNodeRangeWithLocale(node, start, end, key);
            totalWraps += 1;
        }
    }
}

function applyLocaleFontsToTypewriterChars(containerEl, activeKeys) {
    if (!containerEl) return;
    const chars = Array.from(containerEl.querySelectorAll('.ny-tw-char, .custom-ny-tw-char'));
    let prevKey = '';

    for (const el of chars) {
        if (!(el instanceof HTMLElement)) continue;

        // Custom independent font always wins.
        if (el.closest(`[${CUSTOM_INDEPENDENT_FONT_MARK_ATTR}]`)) {
            el.removeAttribute(LOCALE_FONT_ATTR);
            continue;
        }
        if (el.closest(`.${CUSTOM_INDEPENDENT_FONT_CLASS}, .custom-${CUSTOM_INDEPENDENT_FONT_CLASS}`)) {
            el.removeAttribute(LOCALE_FONT_ATTR);
            continue;
        }

        const key = getLocaleKeyForSegment(el.textContent || '', activeKeys, prevKey);
        if (key) {
            el.setAttribute(LOCALE_FONT_ATTR, key);
        } else {
            el.removeAttribute(LOCALE_FONT_ATTR);
        }
        prevKey = key;
    }
}

function applyLocaleFonts(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) return;

    const localeFontMap = getActiveLocaleFontMap();
    const activeKeys = new Set(localeFontMap.keys());
    const active = settings.fontsEnabled && settings.localeFontEnabled && activeKeys.size > 0;

    if (!active) {
        clearLocaleFontProcessing(containerEl);
        localeFontProcessSig.delete(containerEl);
        return;
    }

    const rulesSig = Array.from(localeFontMap.entries())
        .map(([k, v]) => `${k}:${v}`)
        .join('|');

    const sig = getLocaleFontContainerSignature(containerEl, rulesSig);
    const prevSig = localeFontProcessSig.get(containerEl);
    if (prevSig === sig) return;

    clearLocaleFontProcessing(containerEl);

    applyLocaleFontsToTextNodes(containerEl, activeKeys);
    applyLocaleFontsToTypewriterChars(containerEl, activeKeys);

    localeFontProcessSig.set(containerEl, getLocaleFontContainerSignature(containerEl, rulesSig));
}

function splitGraphemes(text) {
    if (!text) return [];
    if (graphemeSegmenter) {
        return Array.from(graphemeSegmenter.segment(text), part => part.segment);
    }
    return Array.from(text);
}

function segmentText(text, granularity) {
    const raw = String(text ?? '');
    if (!raw) return [];

    const resolved = String(granularity || 'word');
    if (resolved === 'grapheme') {
        return splitGraphemes(raw);
    }

    const segmenter = getStreamAnimSegmenter(resolved);
    if (!segmenter) return [raw];
    return Array.from(segmenter.segment(raw), part => part.segment);
}

function segmentTextForStreamingAnimation(rootEl, { granularity = 'word', baseIndex = 0 } = {}) {
    if (!rootEl || !(rootEl instanceof HTMLElement)) return { totalIndex: 0 };

    let globalIndex = 0;
    const resolvedGranularity = String(granularity || 'word');
    const segmentLineBreaks = resolvedGranularity === 'grapheme';
    const splitSegmentParts = (segment) => {
        const raw = String(segment ?? '');
        if (!raw) return [];
        // Keep whitespace as its own segment so it can render as normal inline whitespace
        // (inline-block whitespace segments can collapse to zero width in some browsers).
        return raw.match(/[\s\u200B\u200C\u200D\uFEFF]+|[^\s\u200B\u200C\u200D\uFEFF]+/g) || [raw];
    };
    const shouldCountSegment = (segment) => {
        if (segment === '\r') return false;
        if (segmentLineBreaks) return true;
        return Boolean(String(segment || '').trim().length);
    };

    const walker = document.createTreeWalker(rootEl, segmentLineBreaks ? (NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT) : NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node) return NodeFilter.FILTER_REJECT;

            if (segmentLineBreaks && node instanceof HTMLBRElement) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest(`.${STREAM_SEG_CLASS}`)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('pre, code, textarea, script, style')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
            if (node.nodeType === Node.ELEMENT_NODE) return NodeFilter.FILTER_SKIP;

            if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`.${STREAM_SEG_CLASS}`)) return NodeFilter.FILTER_REJECT;
            if (parent.closest('pre, code, textarea, script, style')) return NodeFilter.FILTER_REJECT;
            if (/^\\s*$/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const nodes = [];
    let n = walker.nextNode();
    while (n) {
        nodes.push(n);
        n = walker.nextNode();
    }

    for (const node of nodes) {
        if (node instanceof HTMLBRElement) {
            const span = document.createElement('span');
            span.className = STREAM_SEG_CLASS;
            span.setAttribute(STREAM_SEG_BR_ATTR, '1');

            const isNew = globalIndex >= baseIndex;
            if (isNew) span.setAttribute(STREAM_SEG_NEW_ATTR, '1');
            span.style.setProperty('--nytw-stream-i', String(Math.max(0, globalIndex - baseIndex)));

            node.replaceWith(span);
            span.appendChild(node);

            globalIndex += 1;
            continue;
        }

        const textNode = /** @type {Text} */ (node);
        const fragment = document.createDocumentFragment();
        const segments = segmentText(textNode.data, resolvedGranularity);
        for (const segment of segments) {
            if (segment === '\r') continue;
            if (segment === '\n') continue;

            const parts = splitSegmentParts(segment);
            for (const part of parts) {
                if (!part) continue;
                if (part === '\r') continue;
                if (part === '\n') continue;

                const span = document.createElement('span');
                span.className = STREAM_SEG_CLASS;
                if (/^[\s\u200B\u200C\u200D\uFEFF]+$/.test(part)) {
                    span.setAttribute(STREAM_SEG_WS_ATTR, '1');
                }

                const isNew = globalIndex >= baseIndex;
                if (isNew) span.setAttribute(STREAM_SEG_NEW_ATTR, '1');
                span.style.setProperty('--nytw-stream-i', String(Math.max(0, globalIndex - baseIndex)));
                span.textContent = part;
                fragment.appendChild(span);

                if (shouldCountSegment(part)) globalIndex += 1;
            }
        }
        textNode.replaceWith(fragment);
    }

    return { totalIndex: globalIndex };
}

function parseTimeToMs(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    if (raw.endsWith('ms')) return Number(raw.slice(0, -2)) || 0;
    if (raw.endsWith('s')) return (Number(raw.slice(0, -1)) || 0) * 1000;
    return Number(raw) || 0;
}

function typewriterizeNode(node, ctx) {
    if (!node) return document.createDocumentFragment();

    if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        const segments = splitGraphemes(node.textContent || '');
        for (const segment of segments) {
            if (segment === '\r') continue;
            if (segment === '\n') {
                frag.appendChild(document.createElement('br'));
                continue;
            }
            const span = document.createElement('span');
            span.className = CHAR_CLASS;
            span.style.setProperty('--ny-tw-i', String(ctx.index));
            span.textContent = segment;
            frag.appendChild(span);
            if (segment.trim().length) ctx.index += 1;
        }
        return frag;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */ (node);

        if (el.tagName === 'BR') {
            return document.createElement('br');
        }

        if (el.tagName === 'Q') {
            const clone = /** @type {HTMLElement} */ (el.cloneNode(false));
            clone.style.setProperty('--ny-tw-q-open-i', String(ctx.index));
            ctx.index += 1;
            el.childNodes.forEach(child => clone.appendChild(typewriterizeNode(child, ctx)));
            clone.style.setProperty('--ny-tw-q-close-i', String(ctx.index));
            ctx.index += 1;
            return clone;
        }

        const clone = /** @type {Element} */ (el.cloneNode(false));
        el.childNodes.forEach(child => clone.appendChild(typewriterizeNode(child, ctx)));
        return clone;
    }

    return document.createDocumentFragment();
}

function countExistingTypewriterChars(innerEl) {
    if (!innerEl) return 0;
    let charCount = 0;
    innerEl.querySelectorAll('.ny-tw-char').forEach((el) => {
        if ((el.textContent || '').trim().length) charCount += 1;
    });
    charCount += innerEl.querySelectorAll('q').length * 2;
    return charCount;
}

function hasNonEmptyTextContent(innerEl) {
    if (!innerEl) return false;
    return (innerEl.textContent || '').trim().length > 0;
}

function ensureProcessed(dialogueEl) {
    if (!dialogueEl) return { charCount: 0 };

    const inner = dialogueEl.firstElementChild;
    if (!inner) return { charCount: 0 };

    if (dialogueEl.getAttribute(PROCESSED_ATTR) === '1') {
        const existingCharCount = countExistingTypewriterChars(inner);
        if (existingCharCount > 0 || !hasNonEmptyTextContent(inner)) {
            if (dialogueEl.getAttribute(COUNT_ATTR) !== String(existingCharCount)) {
                dialogueEl.setAttribute(COUNT_ATTR, String(existingCharCount));
            }
            return { charCount: existingCharCount };
        }

        // Content changed after processing (e.g. SillyTavern post-processing),
        // so we need to rebuild per-grapheme nodes.
        dialogueEl.removeAttribute(PROCESSED_ATTR);
        dialogueEl.removeAttribute(COUNT_ATTR);
    }

    const ctx = { index: 0 };
    const frag = document.createDocumentFragment();
    inner.childNodes.forEach(node => frag.appendChild(typewriterizeNode(node, ctx)));
    inner.textContent = '';
    inner.appendChild(frag);

    dialogueEl.setAttribute(PROCESSED_ATTR, '1');
    dialogueEl.setAttribute(COUNT_ATTR, String(ctx.index));
    return { charCount: ctx.index };
}

function wrapBundleQuotesAndCustom(rootEl) {
    if (!rootEl || !(rootEl instanceof HTMLElement)) return;
    if (rootEl.getAttribute(BUNDLE_PROCESSED_ATTR) === '1') return;

    applyQuoteWrapping(rootEl);

    const dialogueId = rootEl.getAttribute('data-ny-dialogue-id') || '';
    const customId = rootEl.getAttribute('data-ny-custom-id') || '';

    const dialogueTypewriter = rootEl.getAttribute('data-ny-dialogue-tw') === '1';
    const dialogueSkippable = rootEl.getAttribute('data-ny-dialogue-skip') === '1';
    const customTypewriter = rootEl.getAttribute('data-ny-custom-tw') === '1';
    const customSkippable = rootEl.getAttribute('data-ny-custom-skip') === '1';

    const dialogueOuterClass = dialogueId ? `ny-dialogue-${dialogueId}` : '';
    const dialogueInnerClass = dialogueId ? `ny-dialogue-inner-${dialogueId}` : '';
    const customOuterClass = customId ? `ny-custom-${customId}` : '';
    const customInnerClass = customId ? `ny-custom-inner-${customId}` : '';

    const customOpen = safeDecodeURIComponent(rootEl.getAttribute('data-ny-custom-open') || '');
    const customClose = safeDecodeURIComponent(rootEl.getAttribute('data-ny-custom-close') || '');

    const wrapQ = (q, outerClass, innerClass, baseClass, typewriter, skippable) => {
        if (!q || !(q instanceof HTMLElement)) return;
        if (!outerClass || !innerClass) return;
        if (!q.parentNode) return;

        const outer = document.createElement('span');
        outer.className = buildScopedClassNames(
            baseClass,
            outerClass,
            typewriter ? 'Ny-font-manager' : '',
        );
        if (typewriter && skippable) outer.setAttribute('tabindex', '0');

        const inner = document.createElement('span');
        inner.className = buildScopedClassNames(innerClass);

        outer.appendChild(inner);
        q.parentNode.replaceChild(outer, q);
        inner.appendChild(q);
    };

    // 1) Wrap <q> elements into dialogue/custom wrappers.
    //    IMPORTANT: SillyTavern wraps multiple quote pairs into <q>, including 『』.
    //    If the user sets custom delimiters to 『』, those <q> must be treated as custom, not dialogue.
    const dialoguePairs = DIALOGUE_QUOTE_PAIRS;
    const qEls = Array.from(rootEl.querySelectorAll('q'));
    for (const q of qEls) {
        if (!(q instanceof HTMLElement)) continue;
        if (!q.parentElement) continue;
        if (dialogueOuterClass && q.closest(`.${dialogueOuterClass}`)) continue;
        if (customOuterClass && q.closest(`.${customOuterClass}`)) continue;

        const qText = (q.textContent || '').trim();
        const isCustomQ = Boolean(
            customOpen
            && customClose
            && qText.startsWith(customOpen)
            && qText.endsWith(customClose)
            && qText.length >= (customOpen.length + customClose.length),
        );
        const isDialogueQ = dialoguePairs.some(([open, close]) => (
            qText.startsWith(open)
            && qText.endsWith(close)
            && qText.length >= (open.length + close.length)
        ));

        if (isCustomQ) {
            q.removeAttribute('data-ny-q-plain');
            wrapQ(q, customOuterClass, customInnerClass, 'ny-custom', customTypewriter, customSkippable);
            continue;
        }

        if (isDialogueQ) {
            q.removeAttribute('data-ny-q-plain');
            wrapQ(q, dialogueOuterClass, dialogueInnerClass, 'ny-dialogue', dialogueTypewriter, dialogueSkippable);
            continue;
        }

        q.setAttribute('data-ny-q-plain', '1');
    }

    // 2) Wrap custom symbol pairs in text nodes into custom wrappers.
    if (customOuterClass && customInnerClass && customOpen && customClose) {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (!node.nodeValue.includes(customOpen)) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest(`.${customOuterClass}`)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('style, script, textarea, pre, code')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });

        const textNodes = [];
        let n = walker.nextNode();
        while (n) {
            textNodes.push(/** @type {Text} */ (n));
            n = walker.nextNode();
        }

        const openLen = customOpen.length;
        const closeLen = customClose.length;
        for (const textNode of textNodes) {
            const text = textNode.nodeValue || '';
            let idx = 0;
            let changed = false;
            const frag = document.createDocumentFragment();

            while (idx < text.length) {
                const openIdx = text.indexOf(customOpen, idx);
                if (openIdx === -1) break;
                const closeIdx = text.indexOf(customClose, openIdx + openLen);
                if (closeIdx === -1) break;

                if (openIdx > idx) {
                    frag.appendChild(document.createTextNode(text.slice(idx, openIdx)));
                }

                const matchedText = text.slice(openIdx, closeIdx + closeLen);
                const outer = document.createElement('span');
                outer.className = buildScopedClassNames(
                    'ny-custom',
                    customOuterClass,
                    customTypewriter ? 'Ny-font-manager' : '',
                );
                if (customTypewriter && customSkippable) outer.setAttribute('tabindex', '0');

                const inner = document.createElement('span');
                inner.className = buildScopedClassNames(customInnerClass);
                inner.textContent = matchedText;
                outer.appendChild(inner);
                frag.appendChild(outer);

                changed = true;
                idx = closeIdx + closeLen;
            }

            if (!changed) continue;
            if (idx < text.length) {
                frag.appendChild(document.createTextNode(text.slice(idx)));
            }
            textNode.parentNode?.replaceChild(frag, textNode);
        }
    }

    rootEl.setAttribute(BUNDLE_PROCESSED_ATTR, '1');
}

function cleanupStreamingBuffer(messageEl) {
    if (!messageEl || !(messageEl instanceof HTMLElement)) return;
    messageEl.removeAttribute(STREAM_RENDER_ATTR);
    messageEl.removeAttribute(STREAM_ANIM_ATTR);
    messageEl.removeAttribute(STREAM_CURSOR_ATTR);
    messageEl.style?.removeProperty?.(STREAM_STEP_VAR);
    messageEl.style?.removeProperty?.('--nytw-stream-p-mt');
    messageEl.style?.removeProperty?.('--nytw-stream-p-mb');
    messageEl.style?.removeProperty?.('--nytw-stream-p-mb-last');
    const buffer = messageEl.querySelector(`.mes_text.${STREAM_BUFFER_CLASS}`);
    buffer?.remove();
}

function findStreamingSourceMesText(messageEl) {
    if (!messageEl || !(messageEl instanceof HTMLElement)) return null;
    const candidates = Array.from(messageEl.querySelectorAll('.mes_text'));
    for (const el of candidates) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.classList.contains(STREAM_BUFFER_CLASS)) continue;
        return el;
    }
    return null;
}

function syncStreamingParagraphMargins(messageEl, sourceEl) {
    if (!messageEl || !(messageEl instanceof HTMLElement)) return;
    if (!sourceEl || !(sourceEl instanceof HTMLElement)) return;

    const ps = Array.from(sourceEl.querySelectorAll('p'));
    if (!ps.length) return;
    const firstP = ps[0];
    const lastP = ps[ps.length - 1];
    if (!(firstP instanceof HTMLElement) || !(lastP instanceof HTMLElement)) return;

    const firstStyle = getComputedStyle(firstP);
    const lastStyle = getComputedStyle(lastP);
    messageEl.style?.setProperty?.('--nytw-stream-p-mt', firstStyle.marginTop);
    messageEl.style?.setProperty?.('--nytw-stream-p-mb', firstStyle.marginBottom);
    messageEl.style?.setProperty?.('--nytw-stream-p-mb-last', lastStyle.marginBottom);
}

function syncStreamingBuffer(messageEl, { animEffect = 'none' } = {}) {
    if (!messageEl || !(messageEl instanceof HTMLElement)) return null;
    const source = findStreamingSourceMesText(messageEl);
    if (!source) return null;
    syncStreamingParagraphMargins(messageEl, source);

    let buffer = messageEl.querySelector(`.mes_text.${STREAM_BUFFER_CLASS}`);
    if (!(buffer instanceof HTMLElement)) {
        buffer = document.createElement('div');
        buffer.className = `mes_text ${STREAM_BUFFER_CLASS}`;
        source.insertAdjacentElement('afterend', buffer);
    }

    const nextHtml = source.innerHTML;
    const effect = normalizeStreamAnimEffect(animEffect);
    const stepMs = clampStreamAnimSpeed(settings.streamAnimSpeed);
    if (effect === 'none') {
        if (buffer.innerHTML !== nextHtml) {
            buffer.innerHTML = nextHtml;
        }
        return buffer;
    }

    const granularity = effect === 'typewriter' ? 'grapheme' : 'word';
    const nextSig = `${nextHtml.length}:${nextHtml.length ? nextHtml.charCodeAt(nextHtml.length - 1) : 0}`;

    const prevMode = buffer.dataset.nytwStreamSegMode || '';
    const prevSig = buffer.dataset.nytwStreamSrcSig || '';
    if (prevMode === granularity && prevSig === nextSig) {
        ensureTypewriterStreamProgress(buffer, { stepMs, effect, granularity });
        return buffer;
    }

    const prevShownCount = prevMode === granularity ? (Number(buffer.dataset[STREAM_SHOWN_COUNT_DATA]) || 0) : 0;
    const baseIndex = prevMode === granularity ? prevShownCount : 0;
    const target = /** @type {HTMLElement} */ (buffer.cloneNode(false));
    target.innerHTML = nextHtml;
    stripStreamingBufferWhitespace(target);

    // Apply font processing first so quote/custom/locale wrappers remain intact.
    processContainerInner(target, { enableTypewriter: false });

    const { totalIndex } = segmentTextForStreamingAnimation(target, { granularity, baseIndex });

    target.dataset[STREAM_SEG_COUNT_DATA] = String(totalIndex);
    target.dataset[STREAM_SHOWN_COUNT_DATA] = String(Math.min(prevShownCount, totalIndex));
    target.dataset.nytwStreamSegMode = granularity;
    target.dataset.nytwStreamSrcSig = nextSig;

    morphdom(buffer, target);

    ensureTypewriterStreamProgress(buffer, { stepMs, effect, granularity });
    return buffer;
}

function syncTypewriterStreamBlockVisibility(bufferEl) {
    if (!bufferEl || !(bufferEl instanceof HTMLElement)) return;

    const blocks = bufferEl.querySelectorAll('p, li, blockquote, pre, ul, ol');
    const hasMeaningfulMedia = (el) => Boolean(el.querySelector('img, video, audio, svg, canvas, iframe'));

    for (const block of blocks) {
        if (!(block instanceof HTMLElement)) continue;

        const hasRevealedSeg = Boolean(block.querySelector(`.${STREAM_SEG_CLASS}:not([${STREAM_SEG_NEW_ATTR}])`));
        const hasAnySeg = Boolean(block.querySelector(`.${STREAM_SEG_CLASS}`));
        const isEmptyText = !hasMeaningfulMedia(block) && !String(block.textContent || '').trim();

        const shouldHide = !hasRevealedSeg && (hasAnySeg || isEmptyText);
        if (shouldHide) {
            if (block.getAttribute(STREAM_BLOCK_HIDDEN_ATTR) !== '1') {
                block.setAttribute(STREAM_BLOCK_HIDDEN_ATTR, '1');
                block.style.display = 'none';
            }
        } else if (block.getAttribute(STREAM_BLOCK_HIDDEN_ATTR) === '1') {
            block.style.removeProperty('display');
            block.removeAttribute(STREAM_BLOCK_HIDDEN_ATTR);
        }
    }
}

function syncTypewriterStreamCursor(bufferEl) {
    if (!bufferEl || !(bufferEl instanceof HTMLElement)) return;

    bufferEl.querySelectorAll(`.${STREAM_CURSOR_CLASS}`).forEach((el) => el.remove());

    const messageEl = bufferEl.closest('.mes');
    const cursorEnabled = Boolean(messageEl instanceof HTMLElement && messageEl.getAttribute(STREAM_CURSOR_ATTR) === '1');
    if (!cursorEnabled) return;

    const cursorEl = document.createElement('span');
    cursorEl.className = STREAM_CURSOR_CLASS;
    cursorEl.setAttribute('aria-hidden', 'true');

    const shownSegs = bufferEl.querySelectorAll(`.${STREAM_SEG_CLASS}:not([${STREAM_SEG_NEW_ATTR}])`);
    const lastShownSeg = shownSegs.length ? shownSegs[shownSegs.length - 1] : null;
    if (lastShownSeg instanceof HTMLElement) {
        lastShownSeg.insertAdjacentElement('afterend', cursorEl);
    } else {
        bufferEl.prepend(cursorEl);
    }
}

function ensureTypewriterStreamProgress(bufferEl, { stepMs = 20, effect = 'typewriter', granularity = 'grapheme' } = {}) {
    if (!bufferEl || !(bufferEl instanceof HTMLElement)) return;
    const resolvedEffect = normalizeStreamAnimEffect(effect);
    if (resolvedEffect === 'none') return;

    const resolvedStepMs = clampStreamAnimSpeed(stepMs);
    const isSyncMode = stepMs <= 0;

    // Optimized path for "Follow Actual Speed" (Sync Mode)
    // Instantly reveal all pending segments without using timers.
    if (isSyncMode) {
        const pending = bufferEl.querySelectorAll(`.${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]`);
        if (pending.length > 0) {
            pending.forEach((next) => {
                if (!(next instanceof HTMLElement)) return;
                
                if (resolvedEffect === 'blur') {
                    next.style.opacity = '0';
                    next.style.filter = 'blur(10px)';
                    next.style.animation = 'nytw-stream-blur-in 320ms cubic-bezier(.2,.8,.2,1) both';
                } else if (resolvedEffect === 'glow') {
                    next.style.opacity = '0';
                    next.style.textShadow = '0 0 0 rgba(120,180,255,.0)';
                    next.style.animation = 'nytw-stream-glow-in 420ms cubic-bezier(.18,.89,.32,1.05) both';
                }

                next.style.removeProperty('display');
                next.removeAttribute(STREAM_SEG_NEW_ATTR);
            });

            // Update counts in batch
            const shown = Number(bufferEl.dataset[STREAM_SHOWN_COUNT_DATA]) || 0;
            // In sync mode, we assume all segments are shown
            const total = Number(bufferEl.dataset[STREAM_SEG_COUNT_DATA]) || 0;
            bufferEl.dataset[STREAM_SHOWN_COUNT_DATA] = String(Math.max(shown, total));

            syncTypewriterStreamBlockVisibility(bufferEl);
            syncTypewriterStreamCursor(bufferEl);
        }
        // Clear any existing timer if we switched from normal speed to sync
        const existing = streamTypewriterTimers.get(bufferEl);
        if (existing?.timerId) clearTimeout(existing.timerId);
        streamTypewriterTimers.delete(bufferEl);
        return;
    }

    bufferEl.querySelectorAll(`.${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.display = 'none';
    });
    syncTypewriterStreamBlockVisibility(bufferEl);
    syncTypewriterStreamCursor(bufferEl);

    const state = streamTypewriterTimers.get(bufferEl) || {
        timerId: 0,
        stepMs: resolvedStepMs,
        effect: resolvedEffect,
        granularity: String(granularity || 'grapheme'),
    };
    state.stepMs = resolvedStepMs;
    state.effect = resolvedEffect;
    state.granularity = String(granularity || state.granularity || 'grapheme');
    streamTypewriterTimers.set(bufferEl, state);

    if (state.timerId) return;

    const tick = () => {
        state.timerId = 0;
        if (!bufferEl.isConnected) {
            streamTypewriterTimers.delete(bufferEl);
            return;
        }

        const next = bufferEl.querySelector(`.${STREAM_SEG_CLASS}[${STREAM_SEG_NEW_ATTR}]`);
        if (!(next instanceof HTMLElement)) return;

        // Ensure containers stay collapsed until their first segment is revealed.
        let parent = next.parentElement;
        while (parent && parent !== bufferEl) {
            if (parent.matches?.('p, li, blockquote, pre, ul, ol')) {
                parent.style.removeProperty('display');
                parent.removeAttribute(STREAM_BLOCK_HIDDEN_ATTR);
            }
            parent = parent.parentElement;
        }

        // Place cursor exactly before the next segment to be revealed.
        bufferEl.querySelectorAll(`.${STREAM_CURSOR_CLASS}`).forEach((el) => el.remove());
        const messageEl = bufferEl.closest('.mes');
        const cursorEnabled = Boolean(messageEl instanceof HTMLElement && messageEl.getAttribute(STREAM_CURSOR_ATTR) === '1');
        if (cursorEnabled) {
            const cursorEl = document.createElement('span');
            cursorEl.className = STREAM_CURSOR_CLASS;
            cursorEl.setAttribute('aria-hidden', 'true');
            next.parentNode?.insertBefore(cursorEl, next);
        }

        if (state.effect === 'blur') {
            next.style.opacity = '0';
            next.style.filter = 'blur(10px)';
            next.style.animation = 'nytw-stream-blur-in 320ms cubic-bezier(.2,.8,.2,1) both';
        } else if (state.effect === 'glow') {
            next.style.opacity = '0';
            next.style.textShadow = '0 0 0 rgba(120,180,255,.0)';
            next.style.animation = 'nytw-stream-glow-in 420ms cubic-bezier(.18,.89,.32,1.05) both';
        }

        next.style.removeProperty('display');
        next.removeAttribute(STREAM_SEG_NEW_ATTR);

        const shown = Number(bufferEl.dataset[STREAM_SHOWN_COUNT_DATA]) || 0;
        const shouldCount = state.granularity === 'grapheme'
            || next.getAttribute(STREAM_SEG_BR_ATTR) === '1'
            || Boolean(String(next.textContent || '').trim().length);
        bufferEl.dataset[STREAM_SHOWN_COUNT_DATA] = String(shown + (shouldCount ? 1 : 0));
        syncTypewriterStreamBlockVisibility(bufferEl);
        syncTypewriterStreamCursor(bufferEl);

        state.timerId = setTimeout(tick, state.stepMs);
    };

    state.timerId = setTimeout(tick, 0);
}

function processContainerInner(containerEl, { enableTypewriter = true } = {}) {
    if (!containerEl) return;

    const customFontEnabled = settings.fontsEnabled
        && settings.customFontWrapEnabled
        && String(settings.customFont || '').trim().length > 0;

    // Bundle mode: a single regex script wraps the whole message and stores config in data-*.
    // We then post-process DOM to wrap quotes/custom ranges so the same CSS rules apply.
    const bundleRoots = Array.from(containerEl.querySelectorAll(BUNDLE_SELECTOR));
    bundleRoots.forEach(wrapBundleQuotesAndCustom);

    applyDialogueFontToQuotes(containerEl);

    const dialogues = Array.from(containerEl.querySelectorAll(TYPEWRITER_SELECTOR));
    if (!dialogues.length || !enableTypewriter) {
        applyCustomIndependentFont(containerEl, {
            enabled: customFontEnabled,
            openToken: settings.customFontOpen,
            closeToken: settings.customFontClose,
        });
        applyLocaleFonts(containerEl);
        return;
    }

    const restartAnimations = (dialogueEl) => {
        if (!dialogueEl) return;
        dialogueEl.style.animation = 'none';
        void dialogueEl.offsetHeight;
        dialogueEl.style.animation = '';

        const inner = dialogueEl.firstElementChild;
        if (!inner) return;
        inner.style.animation = 'none';
        void inner.offsetHeight;
        inner.style.animation = '';
    };

    let startOffsetMs = 0;
    for (const dialogueEl of dialogues) {
        const stepMs = parseTimeToMs(getComputedStyle(dialogueEl).getPropertyValue('--ny-tw-step')) || 20;
        const startValue = `${Math.max(0, startOffsetMs)}ms`;
        dialogueEl.style.setProperty('--ny-tw-start', startValue);
        const { charCount } = ensureProcessed(dialogueEl);

        // Sync other CSS animations (fade-up / blur / stagger / pop-spring) to the chained start offset.
        // Avoid re-triggering on every scan by caching the last applied start value.
        if (dialogueEl.getAttribute('data-ny-tw-anim-start') !== startValue) {
            restartAnimations(dialogueEl);
            dialogueEl.setAttribute('data-ny-tw-anim-start', startValue);
        }

        startOffsetMs += charCount * stepMs;
    }

    applyCustomIndependentFont(containerEl, {
        enabled: customFontEnabled,
        openToken: settings.customFontOpen,
        closeToken: settings.customFontClose,
    });

    applyLocaleFonts(containerEl);
}

function processContainer(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) return;

    const messageEl = containerEl.closest?.('.mes');
    const activeId = getActiveStreamingMessageId();
    const isActiveStreamingMessage = Boolean(activeId && messageEl?.getAttribute?.('mesid') === activeId);
    const isStreamingMessage = Boolean(messageEl?.classList?.contains(STREAMING_MESSAGE_CLASS)) || isActiveStreamingMessage;

    if (!isStreamingMessage) {
        processContainerInner(containerEl);
        return;
    }

    // When font overrides are disabled, streaming display settings should not apply
    // and we should avoid processing the live streaming message content.
    if (!settings.fontsEnabled) return;

    const mode = getStreamRenderMode();
    if (mode === 'buffer') {
        if (!(messageEl instanceof HTMLElement)) return;

        const animEffect = normalizeStreamAnimEffect(settings.streamAnimEffect);
        if (animEffect !== 'none') {
            syncStreamingBuffer(messageEl, { animEffect });
            return;
        }

        if (containerEl.classList.contains(STREAM_BUFFER_CLASS)) {
            const bufferEl = syncStreamingBuffer(messageEl) || containerEl;
            processContainerInner(bufferEl, { enableTypewriter: false });
            return;
        }

        const bufferEl = syncStreamingBuffer(messageEl);
        if (bufferEl) processContainerInner(bufferEl, { enableTypewriter: false });
    }
}

function scanAndProcess() {
    const containers = new Set();
    document.querySelectorAll(TYPEWRITER_SELECTOR).forEach((el) => {
        const container = el.closest('.mes_text') || el.parentElement;
        if (container && !(container instanceof HTMLElement && container.classList.contains(STREAM_BUFFER_CLASS))) {
            containers.add(container);
        }
    });

    document.querySelectorAll(BUNDLE_SELECTOR).forEach((el) => {
        const container = el.closest('.mes_text') || el.parentElement;
        if (container && !(container instanceof HTMLElement && container.classList.contains(STREAM_BUFFER_CLASS))) {
            containers.add(container);
        }
    });

    document.querySelectorAll(`[${CUSTOM_INDEPENDENT_FONT_MARK_ATTR}]`).forEach((el) => {
        const container = el.closest('.mes_text') || el.parentElement;
        if (container && !(container instanceof HTMLElement && container.classList.contains(STREAM_BUFFER_CLASS))) {
            containers.add(container);
        }
    });

    if (settings.fontsEnabled && String(settings.dialogueFont || '').trim()) {
        document.querySelectorAll(`#chat .mes_text:not(.${STREAM_BUFFER_CLASS})`).forEach((el) => containers.add(el));
    }

    if (
        settings.fontsEnabled
        && settings.customFontWrapEnabled
        && String(settings.customFont || '').trim()
        && String(settings.customFontOpen || '').trim()
        && String(settings.customFontClose || '').trim()
    ) {
        document.querySelectorAll(`#chat .mes_text:not(.${STREAM_BUFFER_CLASS})`).forEach((el) => containers.add(el));
    }

    const hasLocaleMarks = Boolean(document.querySelector(`#chat [${LOCALE_WRAP_ATTR}], #chat [${LOCALE_FONT_ATTR}]`));
    if (getActiveLocaleFontMap().size || hasLocaleMarks) {
        document.querySelectorAll(`#chat .mes_text:not(.${STREAM_BUFFER_CLASS})`).forEach((el) => containers.add(el));
    }

    containers.forEach(processContainer);
}

/** @type {Set<HTMLElement>} */
const pendingContainers = new Set();
/** @type {Set<HTMLElement>} */
const suppressedContainers = new Set();
let fullScanRequested = false;
let scanRafId = 0;
let suppressMutations = false;

function maybeAddMesTextContainerFromNode(node, outSet) {
    if (!node || !outSet) return;
    if (node instanceof HTMLElement) {
        if (node.matches('.mes_text')) {
            outSet.add(node);
            return;
        }

        const closest = node.closest?.('.mes_text');
        if (closest) {
            outSet.add(closest);
            return;
        }

        node.querySelectorAll?.('.mes_text').forEach((el) => outSet.add(el));
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        const closest = parent?.closest?.('.mes_text');
        if (closest) outSet.add(closest);
    }
}

function syncStreamingMessageClass() {
    if (!settings.fontsEnabled) {
        document.querySelectorAll(`#chat .mes.${STREAMING_MESSAGE_CLASS}`).forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            el.classList.remove(STREAMING_MESSAGE_CLASS);
            cleanupStreamingBuffer(el);
        });

        document.querySelectorAll(`#chat .mes[${STREAM_RENDER_ATTR}], #chat .mes[${STREAM_ANIM_ATTR}], #chat .mes[${STREAM_CURSOR_ATTR}]`).forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            el.classList.remove(STREAMING_MESSAGE_CLASS);
            cleanupStreamingBuffer(el);
        });
        return;
    }

    const mode = getStreamRenderMode();
    const animEffect = normalizeStreamAnimEffect(settings.streamAnimEffect);
    const stepMs = clampStreamAnimSpeed(settings.streamAnimSpeed);
    const cursorEnabled = Boolean(settings.streamAnimCursor) && animEffect === 'typewriter';
    const activeId = getActiveStreamingMessageId();

    document.querySelectorAll(`#chat .mes.${STREAMING_MESSAGE_CLASS}`).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (!activeId || el.getAttribute('mesid') !== activeId) {
            el.classList.remove(STREAMING_MESSAGE_CLASS);
            cleanupStreamingBuffer(el);
        }
    });

    if (!activeId) return;

    const activeEl = document.querySelector(`#chat .mes[mesid="${activeId}"]`);
    if (activeEl instanceof HTMLElement) {
        activeEl.classList.add(STREAMING_MESSAGE_CLASS);
        if (mode === 'buffer') {
            activeEl.setAttribute(STREAM_RENDER_ATTR, 'buffer');
            if (animEffect !== 'none') {
                activeEl.setAttribute(STREAM_ANIM_ATTR, animEffect);
            } else {
                activeEl.removeAttribute(STREAM_ANIM_ATTR);
            }
            if (cursorEnabled) {
                activeEl.setAttribute(STREAM_CURSOR_ATTR, '1');
            } else {
                activeEl.removeAttribute(STREAM_CURSOR_ATTR);
            }
            activeEl.style?.setProperty?.(STREAM_STEP_VAR, `${stepMs}ms`);

            syncStreamingBuffer(activeEl, { animEffect });
        } else {
            cleanupStreamingBuffer(activeEl);
        }
    }
}

function flushScan() {
    scanRafId = 0;

    suppressMutations = true;
    try {
        syncStreamingMessageClass();

        if (fullScanRequested) {
            fullScanRequested = false;
            pendingContainers.clear();
            scanAndProcess();
            return;
        }

        if (!pendingContainers.size) return;
        const containers = Array.from(pendingContainers);
        pendingContainers.clear();
        containers.forEach(processContainer);
    } finally {
        queueMicrotask(() => {
            suppressMutations = false;
            if (!suppressedContainers.size) return;

            const containers = Array.from(suppressedContainers).filter((el) => el?.isConnected);
            suppressedContainers.clear();

            if (containers.length) {
                scheduleScan({ full: false, containers });
            } else {
                scheduleScan({ full: true });
            }
        });
    }
}

function scheduleScan({ full = true, containers = null } = {}) {
    if (full) fullScanRequested = true;
    if (containers) {
        for (const el of containers) {
            if (el instanceof HTMLElement) pendingContainers.add(el);
        }
    }

    if (scanRafId) return;
    scanRafId = requestAnimationFrame(flushScan);
}

scheduleScan();

const observer = new MutationObserver((mutations) => {
    const containers = new Set();
    for (const m of mutations) {
        maybeAddMesTextContainerFromNode(m.target, containers);
        m.addedNodes?.forEach((n) => maybeAddMesTextContainerFromNode(n, containers));
    }

    if (containers.size) {
        if (suppressMutations) {
            containers.forEach((el) => {
                if (el instanceof HTMLElement && el.isConnected) suppressedContainers.add(el);
            });
            return;
        }

        scheduleScan({ full: false, containers });
    }
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// Keep streaming state in sync and ensure a final scan after streaming ends.
try {
    eventSource?.on?.(event_types.STREAM_TOKEN_RECEIVED, () => {
        const el = streamingProcessor?.messageTextDom;
        if (el instanceof HTMLElement) scheduleScan({ full: false, containers: [el] });
    });
    eventSource?.on?.(event_types.GENERATION_STARTED, () => scheduleScan({ full: false }));
    eventSource?.on?.(event_types.GENERATION_STOPPED, () => scheduleScan({ full: true }));
    eventSource?.on?.(event_types.GENERATION_ENDED, () => scheduleScan({ full: true }));
} catch { /* no-op */ }

queueApplyFonts();

export { applyTypographyVariables, queueApplyFonts, scheduleScan };
