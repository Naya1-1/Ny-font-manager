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
];

export const DEFAULT_SETTINGS = {
    fontsEnabled: true,
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
    streamRenderMode: 'defer',
    streamAnimEffect: 'none',
    streamAnimSpeed: 20,
    streamAnimCursor: true,
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

export function clampStreamAnimSpeed(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 20;
    return Math.min(80, Math.max(10, Math.round(num)));
}

export function getStreamRenderMode() {
    return normalizeStreamRenderMode(settings.streamRenderMode);
}

function applyDefaultSettings() {
    const hadCustomFontWrapEnabled = settings.customFontWrapEnabled !== undefined;
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

    if (!hadCustomFontWrapEnabled) {
        const hasCustomFont = Boolean(String(settings.customFont || '').trim());
        const hasOpenToken = Boolean(String(settings.customFontOpen || '').trim());
        const hasCloseToken = Boolean(String(settings.customFontClose || '').trim());
        settings.customFontWrapEnabled = hasCustomFont && hasOpenToken && hasCloseToken;
    }
    if (!Array.isArray(settings.importedFonts)) settings.importedFonts = [];
    if (!Array.isArray(settings.localeFonts)) settings.localeFonts = [];

    if (settings.presetsVersion !== 1) {
        for (const preset of PRESET_FONTS) {
            const exists = settings.importedFonts.some(f => f.family === preset.family || f.id === preset.id);
            if (!exists) {
                settings.importedFonts.push({
                    ...preset,
                    kind: 'css',
                });
            }
        }
        settings.presetsVersion = 1;
    }
}

applyDefaultSettings();
