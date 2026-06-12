import { extension_settings } from '../../../extensions.js';

export const EXT_ID = 'Ny-font-manager';
export const extensionFolderPath = `scripts/extensions/third-party/${EXT_ID}`;

extension_settings[EXT_ID] = extension_settings[EXT_ID] || {};
export const settings = extension_settings[EXT_ID];

const PRESET_FONTS = [
    { id: 'preset_zcool_kuaile', family: 'ZCOOL KuaiLe', cssUrl: 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap' },
    { id: 'preset_zcool_xiaowei', family: 'ZCOOL XiaoWei', cssUrl: 'https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap' },
    { id: 'preset_zcool_qingke_huangyou', family: 'ZCOOL QingKe HuangYou', cssUrl: 'https://fonts.googleapis.com/css2?family=ZCOOL+QingKe+HuangYou&display=swap' },
    { id: 'preset_long_cang', family: 'Long Cang', cssUrl: 'https://fonts.googleapis.com/css2?family=Long+Cang&display=swap' },
    { id: 'preset_ma_shan_zheng', family: 'Ma Shan Zheng', cssUrl: 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap' },
    { id: 'preset_zhi_mang_xing', family: 'Zhi Mang Xing', cssUrl: 'https://fonts.googleapis.com/css2?family=Zhi+Mang+Xing&display=swap' },
    { id: 'preset_liu_jian_mao_cao', family: 'Liu Jian Mao Cao', cssUrl: 'https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&display=swap' },
    { id: 'preset_silkscreen', family: 'Silkscreen', cssUrl: 'https://fonts.googleapis.com/css2?family=Silkscreen&display=swap' },
    { id: 'preset_press_start_2p', family: 'Press Start 2P', cssUrl: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap' },
    { id: 'preset_dotgothic16', family: 'DotGothic16', cssUrl: 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap' },
    { id: 'preset_gaegu', family: 'Gaegu', cssUrl: 'https://fonts.googleapis.com/css2?family=Gaegu&display=swap' },
    { id: 'preset_gamja_flower', family: 'Gamja Flower', cssUrl: 'https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap' },
    { id: 'preset_single_day', family: 'Single Day', cssUrl: 'https://fonts.googleapis.com/css2?family=Single+Day&display=swap' },
    { id: 'preset_mea_culpa', family: 'Mea Culpa', cssUrl: 'https://fonts.googleapis.com/css2?family=Mea+Culpa&display=swap' },
    { id: 'preset_Tiejili SC', family: 'Tiejili SC', cssUrl: 'https://fontsapi.zeoseven.com/100/main/result.css' },
    { id: 'preset_boutique_bitmap_9x9', family: 'BoutiqueBitmap9x9', cssUrl: 'https://fontsapi.zeoseven.com/65/main/result.css' },
];

export const DEFAULT_SETTINGS = {
    fontsEnabled: true,
    globalFont: '',
    bodyFont: '',
    dialogueFont: '',
    customFont: '',
    customFontOpen: '',
    customFontClose: '',
    customFontWrapEnabled: false,
    localeFontEnabled: false,
    localeFonts: [],
    importedFonts: [],
    chatFontImportEnabled: false,
    readingStyleEnabled: false,
    overallFontSize: null,
    overallLetterSpacing: null,
    overallLineHeight: null,
    bodyFontSize: null,
    bodyLetterSpacing: null,
    bodyTextColor: '',
    bodyParagraphSpacing: null,
    bodyTextIndent: null,
    bodyFontWeight: '',
    bodyFontStyle: '',
    dialogueFontSize: null,
    dialogueLetterSpacing: null,
    dialogueLineHeight: null,
    dialogueTextColor: '',
    dialogueParagraphSpacing: null,
    dialogueTextIndent: null,
    dialogueFontWeight: '',
    dialogueFontStyle: '',
    overallTextColor: '',
    overallParagraphSpacing: null,
    overallTextIndent: null,
    overallFontWeight: '',
    overallFontStyle: '',
    customFontSize: null,
    customLetterSpacing: null,
    localeFontSize: null,
    localeLetterSpacing: null,
    lineHeight: null,
    readingStylePresets: [],
    streamRenderMode: 'defer',
    streamAnimEffect: 'none',
    streamAnimSpeed: 20,
    streamAnimCursor: true,
    streamAnimCursorShape: 'bar',
    streamAnimCursorAnim: 'blink',
    streamAnimCursorImageUrl: '',
    textAnimEnabled: false,
    textAnimGlobalEffect: 'breath',
    textAnimGlobalColor: '',
    textAnimGlobalIntensity: 35,
    textAnimGlobalPeriod: 8,
    textAnimBodyOverride: false,
    textAnimBodyEffect: 'breath',
    textAnimBodyColor: '',
    textAnimBodyIntensity: 35,
    textAnimBodyPeriod: 8,
    textAnimDialogueOverride: true,
    textAnimDialogueEffect: 'edge-glow',
    textAnimDialogueColor: '',
    textAnimDialogueIntensity: 40,
    textAnimDialoguePeriod: 8,
    presetsVersion: 0,
};

export function normalizeStreamRenderMode(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'buffer') return 'buffer';
    return 'defer';
}

export function normalizeStreamAnimEffect(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'typewriter') return 'typewriter';
    if (raw === 'blur') return 'blur';
    if (raw === 'glow') return 'glow';
    return 'none';
}

export function normalizeStreamCursorShape(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'block') return 'block';
    if (raw === 'underscore') return 'underscore';
    if (raw === 'hollow') return 'hollow';
    if (raw === 'thin') return 'thin';
    if (raw === 'image') return 'image';
    return 'bar';
}

export function normalizeStreamCursorAnim(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'pulse') return 'pulse';
    if (raw === 'solid') return 'solid';
    if (raw === 'smooth') return 'smooth';
    if (raw === 'elastic') return 'elastic';
    if (raw === 'glitch') return 'glitch';
    return 'blink';
}

export function normalizeStreamCursorImageUrl(value) {
    return String(value ?? '').trim();
}

export function clampStreamAnimSpeed(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 20;
    if (num <= 0) return 0;
    return Math.min(80, Math.max(3, Math.round(num)));
}

export function normalizeTextAnimEffect(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'breath') return 'breath';
    if (raw === 'edge-glow') return 'edge-glow';
    if (raw === 'sweep') return 'sweep';
    if (raw === 'ink') return 'ink';
    if (raw === 'candle') return 'candle';
    if (raw === 'paper') return 'paper';
    if (raw === 'frost') return 'frost';
    if (raw === 'glitch') return 'glitch';
    return 'none';
}

export function clampTextAnimIntensity(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 35;
    return Math.min(80, Math.max(0, Math.round(num)));
}

export function clampTextAnimPeriod(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 8;
    const clamped = Math.min(30, Math.max(3, num));
    return Math.round(clamped * 2) / 2;
}

export function normalizeTextAnimColor(value) {
    return normalizeOptionalCssColor(value);
}

function parseOptionalNumber(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const num = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    return Number.isFinite(num) ? num : null;
}

export function clampOptionalFontSize(value) {
    const num = parseOptionalNumber(value);
    if (num === null) return null;
    if (num <= 0) return null;
    const clamped = Math.min(72, Math.max(6, num));
    return Math.round(clamped * 2) / 2; // 0.5px steps
}

export function clampOptionalLetterSpacing(value) {
    const num = parseOptionalNumber(value);
    if (num === null) return null;
    const clamped = Math.min(0.5, Math.max(-0.2, num));
    return Math.round(clamped * 100) / 100; // 0.01em steps
}

export function clampOptionalLineHeight(value) {
    const num = parseOptionalNumber(value);
    if (num === null) return null;
    const clamped = Math.min(3, Math.max(0.8, num));
    return Math.round(clamped * 100) / 100; // 0.01 steps
}

export function clampOptionalParagraphSpacing(value) {
    const num = parseOptionalNumber(value);
    if (num === null) return null;
    const clamped = Math.min(6, Math.max(0, num));
    return Math.round(clamped * 100) / 100; // 0.01em steps
}

export function clampOptionalTextIndent(value) {
    const num = parseOptionalNumber(value);
    if (num === null) return null;
    const clamped = Math.min(8, Math.max(0, num));
    return Math.round(clamped * 100) / 100; // 0.01em steps
}

export function normalizeOptionalCssColor(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) return raw;
    if (/^(?:rgb|hsl)a?\([\d\s.,%/+*-]+\)$/i.test(raw)) return raw;
    if (/^(?:transparent|currentColor)$/i.test(raw)) return raw;
    return '';
}

export function normalizeOptionalFontWeight(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'normal' || raw === 'bold') return raw;
    if (/^[1-9]00$/.test(raw)) return raw;
    return '';
}

export function normalizeOptionalFontStyle(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'normal' || raw === 'italic') return raw;
    return '';
}

export function getStreamRenderMode() {
    return normalizeStreamRenderMode(settings.streamRenderMode);
}

function applyDefaultSettings() {
    const hadCustomFontWrapEnabled = settings.customFontWrapEnabled !== undefined;
    const hadTextAnimGlobalEffect = settings.textAnimGlobalEffect !== undefined;
    const hadTextAnimBodyEffect = settings.textAnimBodyEffect !== undefined;
    const hadTextAnimDialogueEffect = settings.textAnimDialogueEffect !== undefined;
    const hadTextAnimBodyOverride = settings.textAnimBodyOverride !== undefined;
    const hadTextAnimDialogueOverride = settings.textAnimDialogueOverride !== undefined;
    const hadLegacyTextAnimEffect = settings.textAnimEffect !== undefined;
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (settings[key] === undefined) {
            settings[key] = globalThis.structuredClone
                ? structuredClone(value)
                : JSON.parse(JSON.stringify(value));
        }
    }

    settings.streamRenderMode = normalizeStreamRenderMode(settings.streamRenderMode);
    settings.streamAnimEffect = normalizeStreamAnimEffect(settings.streamAnimEffect);
    settings.streamAnimSpeed = clampStreamAnimSpeed(settings.streamAnimSpeed);
    settings.streamAnimCursor = Boolean(settings.streamAnimCursor);
    settings.streamAnimCursorShape = normalizeStreamCursorShape(settings.streamAnimCursorShape);
    settings.streamAnimCursorAnim = normalizeStreamCursorAnim(settings.streamAnimCursorAnim);
    settings.streamAnimCursorImageUrl = normalizeStreamCursorImageUrl(settings.streamAnimCursorImageUrl);
    settings.textAnimEnabled = settings.textAnimEnabled === true;
    if (!hadTextAnimGlobalEffect && hadLegacyTextAnimEffect) {
        settings.textAnimGlobalEffect = normalizeTextAnimEffect(settings.textAnimEffect);
        settings.textAnimGlobalColor = normalizeTextAnimColor(settings.textAnimColor);
        settings.textAnimGlobalIntensity = clampTextAnimIntensity(settings.textAnimIntensity);
        settings.textAnimGlobalPeriod = clampTextAnimPeriod(settings.textAnimPeriod);
    } else if (!hadTextAnimGlobalEffect && hadTextAnimBodyEffect) {
        settings.textAnimGlobalEffect = normalizeTextAnimEffect(settings.textAnimBodyEffect);
        settings.textAnimGlobalColor = normalizeTextAnimColor(settings.textAnimBodyColor);
        settings.textAnimGlobalIntensity = clampTextAnimIntensity(settings.textAnimBodyIntensity);
        settings.textAnimGlobalPeriod = clampTextAnimPeriod(settings.textAnimBodyPeriod);
    }
    if (!hadTextAnimBodyEffect && hadLegacyTextAnimEffect) {
        settings.textAnimBodyEffect = normalizeTextAnimEffect(settings.textAnimEffect);
        settings.textAnimBodyColor = normalizeTextAnimColor(settings.textAnimColor);
        settings.textAnimBodyIntensity = clampTextAnimIntensity(settings.textAnimIntensity);
        settings.textAnimBodyPeriod = clampTextAnimPeriod(settings.textAnimPeriod);
    }
    if (!hadTextAnimDialogueEffect && hadLegacyTextAnimEffect) {
        settings.textAnimDialogueEffect = normalizeTextAnimEffect(settings.textAnimEffect);
        settings.textAnimDialogueColor = normalizeTextAnimColor(settings.textAnimColor);
        settings.textAnimDialogueIntensity = clampTextAnimIntensity(settings.textAnimIntensity);
        settings.textAnimDialoguePeriod = clampTextAnimPeriod(settings.textAnimPeriod);
    }
    if (!hadTextAnimBodyOverride && hadTextAnimBodyEffect) {
        settings.textAnimBodyOverride = true;
    }
    if (!hadTextAnimDialogueOverride) {
        if (hadLegacyTextAnimEffect && !hadTextAnimBodyEffect && !hadTextAnimDialogueEffect) {
            settings.textAnimDialogueOverride = false;
        } else if (hadTextAnimDialogueEffect) {
            settings.textAnimDialogueOverride = true;
        }
    }
    settings.textAnimGlobalEffect = normalizeTextAnimEffect(settings.textAnimGlobalEffect);
    settings.textAnimGlobalColor = normalizeTextAnimColor(settings.textAnimGlobalColor);
    settings.textAnimGlobalIntensity = clampTextAnimIntensity(settings.textAnimGlobalIntensity);
    settings.textAnimGlobalPeriod = clampTextAnimPeriod(settings.textAnimGlobalPeriod);
    settings.textAnimBodyOverride = settings.textAnimBodyOverride === true;
    settings.textAnimBodyEffect = normalizeTextAnimEffect(settings.textAnimBodyEffect);
    settings.textAnimBodyColor = normalizeTextAnimColor(settings.textAnimBodyColor);
    settings.textAnimBodyIntensity = clampTextAnimIntensity(settings.textAnimBodyIntensity);
    settings.textAnimBodyPeriod = clampTextAnimPeriod(settings.textAnimBodyPeriod);
    settings.textAnimDialogueOverride = settings.textAnimDialogueOverride === true;
    settings.textAnimDialogueEffect = normalizeTextAnimEffect(settings.textAnimDialogueEffect);
    settings.textAnimDialogueColor = normalizeTextAnimColor(settings.textAnimDialogueColor);
    settings.textAnimDialogueIntensity = clampTextAnimIntensity(settings.textAnimDialogueIntensity);
    settings.textAnimDialoguePeriod = clampTextAnimPeriod(settings.textAnimDialoguePeriod);
    settings.readingStyleEnabled = settings.readingStyleEnabled === true;
    settings.overallFontSize = clampOptionalFontSize(settings.overallFontSize);
    settings.overallLetterSpacing = clampOptionalLetterSpacing(settings.overallLetterSpacing);
    settings.overallLineHeight = clampOptionalLineHeight(settings.overallLineHeight);
    settings.bodyFontSize = clampOptionalFontSize(settings.bodyFontSize);
    settings.bodyLetterSpacing = clampOptionalLetterSpacing(settings.bodyLetterSpacing);
    settings.bodyTextColor = normalizeOptionalCssColor(settings.bodyTextColor);
    settings.bodyParagraphSpacing = clampOptionalParagraphSpacing(settings.bodyParagraphSpacing);
    settings.bodyTextIndent = clampOptionalTextIndent(settings.bodyTextIndent);
    settings.bodyFontWeight = normalizeOptionalFontWeight(settings.bodyFontWeight);
    settings.bodyFontStyle = normalizeOptionalFontStyle(settings.bodyFontStyle);
    settings.dialogueFontSize = clampOptionalFontSize(settings.dialogueFontSize);
    settings.dialogueLetterSpacing = clampOptionalLetterSpacing(settings.dialogueLetterSpacing);
    settings.dialogueLineHeight = clampOptionalLineHeight(settings.dialogueLineHeight);
    settings.dialogueTextColor = normalizeOptionalCssColor(settings.dialogueTextColor);
    settings.dialogueParagraphSpacing = clampOptionalParagraphSpacing(settings.dialogueParagraphSpacing);
    settings.dialogueTextIndent = clampOptionalTextIndent(settings.dialogueTextIndent);
    settings.dialogueFontWeight = normalizeOptionalFontWeight(settings.dialogueFontWeight);
    settings.dialogueFontStyle = normalizeOptionalFontStyle(settings.dialogueFontStyle);
    settings.overallTextColor = normalizeOptionalCssColor(settings.overallTextColor);
    settings.overallParagraphSpacing = clampOptionalParagraphSpacing(settings.overallParagraphSpacing);
    settings.overallTextIndent = clampOptionalTextIndent(settings.overallTextIndent);
    settings.overallFontWeight = normalizeOptionalFontWeight(settings.overallFontWeight);
    settings.overallFontStyle = normalizeOptionalFontStyle(settings.overallFontStyle);
    settings.customFontSize = clampOptionalFontSize(settings.customFontSize);
    settings.customLetterSpacing = clampOptionalLetterSpacing(settings.customLetterSpacing);
    settings.localeFontSize = clampOptionalFontSize(settings.localeFontSize);
    settings.localeLetterSpacing = clampOptionalLetterSpacing(settings.localeLetterSpacing);
    settings.lineHeight = clampOptionalLineHeight(settings.lineHeight);

    if (!hadCustomFontWrapEnabled) {
        const hasCustomFont = Boolean(String(settings.customFont || '').trim());
        const hasOpenToken = Boolean(String(settings.customFontOpen || '').trim());
        const hasCloseToken = Boolean(String(settings.customFontClose || '').trim());
        settings.customFontWrapEnabled = hasCustomFont && hasOpenToken && hasCloseToken;
    }
    if (!Array.isArray(settings.importedFonts)) settings.importedFonts = [];
    if (!Array.isArray(settings.localeFonts)) settings.localeFonts = [];
    if (!Array.isArray(settings.readingStylePresets)) settings.readingStylePresets = [];

    if (settings.presetsVersion < 3) {
        for (const preset of PRESET_FONTS) {
            const exists = settings.importedFonts.some(f => f.family === preset.family || f.id === preset.id);
            if (!exists) {
                settings.importedFonts.push({
                    ...preset,
                    kind: 'css',
                });
            }
        }
        settings.presetsVersion = 3;
    }
}

applyDefaultSettings();
