import { saveSettingsDebounced } from '../../../../script.js';
import { applyTypographyVariables, queueApplyFonts, scheduleScan } from './nytwCore.js';
import { debounce, notify } from './nytwUtils.js';
import {
    clampOptionalFontSize,
    clampOptionalLetterSpacing,
    clampOptionalLineHeight,
    clampOptionalParagraphSpacing,
    clampOptionalTextIndent,
    clampStreamAnimSpeed,
    clampTextAnimIntensity,
    clampTextAnimPeriod,
    clampTextAnimRecentFloors,
    normalizeOptionalCssColor,
    normalizeOptionalFontStyle,
    normalizeOptionalFontWeight,
    normalizeStreamAnimEffect,
    normalizeStreamCursorAnim,
    normalizeStreamCursorImageUrl,
    normalizeStreamCursorShape,
    normalizeStreamRenderMode,
    normalizeTextAnimColor,
    normalizeTextAnimEffect,
    settings,
} from './nytwState.js';

const READING_STYLE_PRESET_SCHEMA = 'Ny-font-manager.reading-style-preset';
const READING_STYLE_PRESET_VERSION = 1;

const READING_STYLE_KEYS = [
    'readingStyleEnabled',
    'overallFontSize',
    'overallLetterSpacing',
    'overallLineHeight',
    'overallTextColor',
    'overallParagraphSpacing',
    'overallTextIndent',
    'overallFontWeight',
    'overallFontStyle',
    'bodyFontSize',
    'bodyLetterSpacing',
    'lineHeight',
    'bodyTextColor',
    'bodyParagraphSpacing',
    'bodyTextIndent',
    'bodyFontWeight',
    'bodyFontStyle',
    'dialogueFontSize',
    'dialogueLetterSpacing',
    'dialogueLineHeight',
    'dialogueTextColor',
    'dialogueParagraphSpacing',
    'dialogueTextIndent',
    'dialogueFontWeight',
    'dialogueFontStyle',
    'customFontSize',
    'customLetterSpacing',
    'localeFontSize',
    'localeLetterSpacing',
];

function cloneJsonValue(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
        reader.readAsText(file);
    });
}

function downloadJsonFile(fileName, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPresetId() {
    return `reading_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPresetExportFileName(name) {
    const safeName = String(name || 'reading-style').trim().replace(/[^\w\u4e00-\u9fff.-]+/g, '-').slice(0, 60) || 'reading-style';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `Ny-font-manager-reading-style-${safeName}-${stamp}.json`;
}

function normalizeReadingStyleValue(key, value) {
    if (key === 'readingStyleEnabled') return value === true;
    if (key.endsWith('FontSize')) return clampOptionalFontSize(value);
    if (key.endsWith('LetterSpacing')) return clampOptionalLetterSpacing(value);
    if (key.endsWith('LineHeight') || key === 'lineHeight') return clampOptionalLineHeight(value);
    if (key.endsWith('TextColor')) return normalizeOptionalCssColor(value);
    if (key.endsWith('ParagraphSpacing')) return clampOptionalParagraphSpacing(value);
    if (key.endsWith('TextIndent')) return clampOptionalTextIndent(value);
    if (key.endsWith('FontWeight')) return normalizeOptionalFontWeight(value);
    if (key.endsWith('FontStyle')) return normalizeOptionalFontStyle(value);
    return value;
}

function getReadingStyleSnapshot() {
    const style = {};
    for (const key of READING_STYLE_KEYS) {
        style[key] = normalizeReadingStyleValue(key, settings[key]);
    }
    return style;
}

function applyReadingStyleSnapshot(style) {
    if (!style || typeof style !== 'object') return;
    for (const key of READING_STYLE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(style, key)) continue;
        settings[key] = normalizeReadingStyleValue(key, style[key]);
    }
}

function normalizeReadingStylePreset(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const sourceStyle = raw.style && typeof raw.style === 'object' ? raw.style : raw;
    const style = {};
    let hasAny = false;
    for (const key of READING_STYLE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(sourceStyle, key)) continue;
        style[key] = normalizeReadingStyleValue(key, sourceStyle[key]);
        hasAny = true;
    }
    if (!hasAny) return null;
    const now = new Date().toISOString();
    const name = String(raw.name || '阅读样式预设').trim().slice(0, 80) || '阅读样式预设';
    return {
        id: String(raw.id || buildPresetId()).trim() || buildPresetId(),
        name,
        createdAt: String(raw.createdAt || now),
        updatedAt: String(raw.updatedAt || now),
        style,
    };
}

function normalizeReadingStylePresets() {
    const rawList = Array.isArray(settings.readingStylePresets) ? settings.readingStylePresets : [];
    const seen = new Set();
    settings.readingStylePresets = rawList
        .map(normalizeReadingStylePreset)
        .filter((preset) => {
            if (!preset || seen.has(preset.id)) return false;
            seen.add(preset.id);
            return true;
        })
        .slice(0, 80);
}

function parseReadingStylePresetPayload(text) {
    let payload;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error('预设文件不是有效的 JSON。');
    }
    if (!payload || typeof payload !== 'object') {
        throw new Error('预设文件格式无效。');
    }
    const preset = normalizeReadingStylePreset(payload);
    if (!preset) {
        throw new Error('预设文件中没有可导入的阅读样式字段。');
    }
    return preset;
}

function upsertReadingStylePreset(preset) {
    normalizeReadingStylePresets();
    const next = Array.isArray(settings.readingStylePresets) ? [...settings.readingStylePresets] : [];
    const index = next.findIndex((item) => String(item?.id || '') === preset.id);
    if (index >= 0) {
        next[index] = preset;
    } else {
        next.push(preset);
    }
    settings.readingStylePresets = next;
}

export function initDisplaySettingsTab() {
    const ensureReadingStyleMarkup = () => {
        const card = document.getElementById('nytw_typography_card');
        if (!card || card.dataset.readingStyleReady === '1') return;
        card.dataset.readingStyleReady = '1';

        const title = card.querySelector('.nytw-card-title');
        if (title) title.textContent = '阅读样式';
        const info = card.querySelector('.nytw-card-info');
        if (info && !info.querySelector('.nytw-card-desc')) {
            const desc = document.createElement('div');
            desc.className = 'nytw-card-desc';
            desc.textContent = '统一调节整体、正文和对话的阅读效果';
            info.appendChild(desc);
        }
        const icon = card.querySelector('.nytw-card-icon i');
        if (icon) icon.className = 'fa-solid fa-book-open-reader';

        const body = card.querySelector('.nytw-card-body-padding');
        if (!body) return;
        const renderReadingSubcard = (iconClass, title, content) => `
                <div class="nytw-card-section nytw-reading-subcard is-collapsed" data-reading-subcard>
                    <button type="button" class="nytw-card-section-header nytw-reading-subcard-toggle" aria-expanded="false">
                        <span class="nytw-card-section-title"><i class="${iconClass}"></i><span>${title}</span></span>
                        <i class="fa-solid fa-chevron-down nytw-reading-subcard-chevron"></i>
                    </button>
                    <div class="nytw-reading-subcard-content">
                        <div class="nytw-reading-subcard-inner">
                            ${content}
                        </div>
                    </div>
                </div>`;
        body.innerHTML = `
            <div class="nytw-reading-style-body" id="nytw_reading_style_body">
                <div class="nytw-reading-toolbar">
                    <label class="nytw-switch nytw-reading-toggle">
                        <input id="nytw_reading_style_enabled" type="checkbox" />
                        <span class="nytw-switch-slider"></span>
                        <span>启用阅读样式</span>
                    </label>
                    <button id="nytw_reading_style_reset" class="menu_button nytw-reader-small-btn" type="button">
                        <i class="fa-solid fa-rotate-left"></i> 重置
                    </button>
                </div>

                <div class="nytw-reading-preview" id="nytw_reading_preview">
                    <p class="nytw-reading-preview-body">这是一段正文，用来预览字号、颜色、段距和缩进。</p>
                    <q class="nytw-reading-preview-dialogue ny-dialogue">这是一句对话，用来预览对话层覆盖效果。</q>
                </div>

                ${renderReadingSubcard('fa-solid fa-bookmark', '预设', `
                    <div class="nytw-reader-preset-panel">
                        <div class="nytw-reader-preset-row nytw-reader-preset-row--select">
                            <select id="nytw_reading_preset_select" class="nytw-mini-select" title="选择预设名即生效"></select>
                            <button id="nytw_reading_preset_new" class="menu_button nytw-preset-btn nytw-preset-btn--primary" type="button"><i class="fa-solid fa-plus"></i> 新建预设</button>
                        </div>
                        <div class="nytw-reader-preset-row nytw-reader-preset-actions">
                            <button id="nytw_reading_preset_save" class="menu_button nytw-preset-btn nytw-preset-btn--action" type="button"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
                            <button id="nytw_reading_preset_delete" class="menu_button nytw-preset-btn nytw-preset-btn--danger" type="button"><i class="fa-solid fa-trash"></i> 删除</button>
                            <button id="nytw_reading_preset_export" class="menu_button nytw-preset-btn nytw-preset-btn--action" type="button"><i class="fa-solid fa-file-export"></i> 导出</button>
                            <button id="nytw_reading_preset_import" class="menu_button nytw-preset-btn nytw-preset-btn--action" type="button"><i class="fa-solid fa-file-import"></i> 导入</button>
                        </div>
                        <input id="nytw_reading_preset_file" type="file" accept="application/json,.json" style="display:none" />
                    </div>
                `)}

                ${renderReadingSubcard('fa-solid fa-text-height', '字号 / 字距 / 行高', `
                    <div class="nytw-style-grid nytw-style-grid--4 nytw-style-grid--head">
                        <div>目标</div><div>字号(px)</div><div>字距(em)</div><div>行高</div>
                    </div>
                    <div class="nytw-style-grid nytw-style-grid--4">
                        <div class="nytw-typo-type"><i class="fa-solid fa-layer-group"></i> 整体</div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_overall_font_size" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="6" max="72" step="0.5" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_overall_letter_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="-0.2" max="0.5" step="0.01" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_overall_line_height" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0.8" max="3" step="0.05" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                    </div>
                    <div class="nytw-style-grid nytw-style-grid--4" id="nytw_typo_row_body">
                        <div class="nytw-typo-type"><i class="fa-solid fa-align-left"></i> 正文</div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_body_font_size" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="6" max="72" step="0.5" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_body_letter_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="-0.2" max="0.5" step="0.01" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_body_line_height" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0.8" max="3" step="0.05" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                    </div>
                    <div class="nytw-style-grid nytw-style-grid--4" id="nytw_typo_row_dialogue">
                        <div class="nytw-typo-type"><i class="fa-solid fa-quote-left"></i> 对话</div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_dialogue_font_size" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="6" max="72" step="0.5" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_dialogue_letter_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="-0.2" max="0.5" step="0.01" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                        <div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_dialogue_line_height" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0.8" max="3" step="0.05" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div>
                    </div>
                `)}

                ${renderReadingSubcard('fa-solid fa-palette', '颜色', `
                    <div class="nytw-style-grid nytw-style-grid--color" data-color-row="overall"><div class="nytw-typo-type"><i class="fa-solid fa-layer-group"></i> 整体</div><input id="nytw_overall_text_color_picker" class="nytw-color-picker" type="color" value="#ffffff" /><input id="nytw_overall_text_color" class="text_pole nytw-reader-text-input" type="text" placeholder="继承 / #ffffff" /></div>
                    <div class="nytw-style-grid nytw-style-grid--color" data-color-row="body"><div class="nytw-typo-type"><i class="fa-solid fa-align-left"></i> 正文</div><input id="nytw_body_text_color_picker" class="nytw-color-picker" type="color" value="#ffffff" /><input id="nytw_body_text_color" class="text_pole nytw-reader-text-input" type="text" placeholder="继承 / #ffffff" /></div>
                    <div class="nytw-style-grid nytw-style-grid--color" data-color-row="dialogue"><div class="nytw-typo-type"><i class="fa-solid fa-quote-left"></i> 对话</div><input id="nytw_dialogue_text_color_picker" class="nytw-color-picker" type="color" value="#ffffff" /><input id="nytw_dialogue_text_color" class="text_pole nytw-reader-text-input" type="text" placeholder="继承 / #ffffff" /></div>
                `)}

                ${renderReadingSubcard('fa-solid fa-paragraph', '段落 / 缩进', `
                    <div class="nytw-style-grid nytw-style-grid--3 nytw-style-grid--head"><div>目标</div><div>段距(em)</div><div>缩进(em)</div></div>
                    <div class="nytw-style-grid nytw-style-grid--3"><div class="nytw-typo-type"><i class="fa-solid fa-layer-group"></i> 整体</div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_overall_paragraph_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0" max="6" step="0.05" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_overall_text_indent" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0" max="8" step="0.25" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div></div>
                    <div class="nytw-style-grid nytw-style-grid--3"><div class="nytw-typo-type"><i class="fa-solid fa-align-left"></i> 正文</div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_body_paragraph_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0" max="6" step="0.05" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_body_text_indent" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0" max="8" step="0.25" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div></div>
                    <div class="nytw-style-grid nytw-style-grid--3"><div class="nytw-typo-type"><i class="fa-solid fa-quote-left"></i> 对话</div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_dialogue_paragraph_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0" max="6" step="0.05" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_dialogue_text_indent" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="0" max="8" step="0.25" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div></div>
                `)}

                ${renderReadingSubcard('fa-solid fa-bold', '字体样式', `
                    <div class="nytw-style-grid nytw-style-grid--3 nytw-style-grid--head"><div>目标</div><div>字重</div><div>倾斜</div></div>
                    <div class="nytw-style-grid nytw-style-grid--3"><div class="nytw-typo-type"><i class="fa-solid fa-layer-group"></i> 整体</div><select id="nytw_overall_font_weight" class="nytw-mini-select"><option value="">继承</option><option value="300">偏细</option><option value="400">正常</option><option value="500">中等</option><option value="600">半粗</option><option value="700">加粗</option><option value="900">特粗</option></select><select id="nytw_overall_font_style" class="nytw-mini-select"><option value="">继承</option><option value="normal">正常</option><option value="italic">倾斜</option></select></div>
                    <div class="nytw-style-grid nytw-style-grid--3"><div class="nytw-typo-type"><i class="fa-solid fa-align-left"></i> 正文</div><select id="nytw_body_font_weight" class="nytw-mini-select"><option value="">继承</option><option value="300">偏细</option><option value="400">正常</option><option value="500">中等</option><option value="600">半粗</option><option value="700">加粗</option><option value="900">特粗</option></select><select id="nytw_body_font_style" class="nytw-mini-select"><option value="">继承</option><option value="normal">正常</option><option value="italic">倾斜</option></select></div>
                    <div class="nytw-style-grid nytw-style-grid--3"><div class="nytw-typo-type"><i class="fa-solid fa-quote-left"></i> 对话</div><select id="nytw_dialogue_font_weight" class="nytw-mini-select"><option value="">继承</option><option value="300">偏细</option><option value="400">正常</option><option value="500">中等</option><option value="600">半粗</option><option value="700">加粗</option><option value="900">特粗</option></select><select id="nytw_dialogue_font_style" class="nytw-mini-select"><option value="">继承</option><option value="normal">正常</option><option value="italic">倾斜</option></select></div>
                `)}

                ${renderReadingSubcard('fa-solid fa-sliders', '高级范围', `
                    <div class="nytw-style-grid nytw-style-grid--3 nytw-style-grid--head"><div>目标</div><div>字号(px)</div><div>字距(em)</div></div>
                    <div class="nytw-style-grid nytw-style-grid--3" id="nytw_typo_row_custom"><div class="nytw-typo-type"><i class="fa-solid fa-highlighter"></i> 自定义</div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_custom_font_size" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="6" max="72" step="0.5" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_custom_letter_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="-0.2" max="0.5" step="0.01" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div></div>
                    <div class="nytw-style-grid nytw-style-grid--3" id="nytw_typo_row_locale"><div class="nytw-typo-type"><i class="fa-solid fa-globe"></i> 多语言</div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_locale_font_size" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="6" max="72" step="0.5" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div><div class="nytw-stepper"><button type="button" class="nytw-stepper-btn minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button><input id="nytw_locale_letter_spacing" type="number" class="text_pole nytw-typo-input" placeholder="继承" min="-0.2" max="0.5" step="0.01" /><button type="button" class="nytw-stepper-btn plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button></div></div>
                `)}
            </div>
        `;
    };

    const bindDisplayCardToggles = () => {
        document.querySelectorAll('.nytw-card-toggle').forEach((toggle) => {
            if (toggle.dataset.nytwCardToggleBound === '1') return;
            toggle.dataset.nytwCardToggleBound = '1';
            toggle.addEventListener('click', () => {
                const card = toggle.closest('.nytw-display-setting-card');
                if (!card) return;
                const willOpen = card.classList.contains('is-collapsed');
                card.classList.toggle('is-collapsed', !willOpen);
            });
        });
    };

    const applyInitialCollapsedCards = () => {
        [
            document.getElementById('nytw_card_stream'),
            document.getElementById('nytw_typography_card'),
        ].forEach((card) => {
            if (!card || card.dataset.nytwInitialCollapseDone === '1') return;
            card.dataset.nytwInitialCollapseDone = '1';
            card.classList.add('is-collapsed');
        });
    };

    ensureReadingStyleMarkup();
    bindDisplayCardToggles();
    applyInitialCollapsedCards();

    document.querySelectorAll('[data-reading-subcard] .nytw-reading-subcard-toggle').forEach((toggle) => {
        if (toggle.dataset.bound === 'true') return;
        toggle.dataset.bound = 'true';
        toggle.addEventListener('click', () => {
            const subcard = toggle.closest('[data-reading-subcard]');
            if (!subcard) return;
            const willOpen = subcard.classList.contains('is-collapsed');
            subcard.classList.toggle('is-collapsed', !willOpen);
            toggle.setAttribute('aria-expanded', String(willOpen));
        });
    });

    const renderModeSelectEls = [
        document.getElementById('nytw_stream_render_mode_display'),
        // Backward compatibility: older layouts used these IDs in other tabs.
        document.getElementById('nytw_stream_render_mode_settings'),
        document.getElementById('nytw_stream_render_mode_import'),
    ].filter((el) => el instanceof HTMLSelectElement);

    const syncRenderModeUi = (mode) => {
        const normalized = normalizeStreamRenderMode(mode);
        renderModeSelectEls.forEach((el) => { el.value = normalized; });

        // Sync Segmented Control UI
        const controlContainer = document.getElementById('nytw_render_mode_control');
        if (controlContainer) {
            const options = controlContainer.querySelectorAll('.nytw-segment-option');
            options.forEach(opt => {
                if (opt.dataset.value === normalized) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });
        }
    };

    const streamAnimSectionEl = document.getElementById('nytw_stream_anim_section');
    const streamAnimHintEl = document.getElementById('nytw_stream_anim_hint');
    const streamAnimEffectEl = document.getElementById('nytw_stream_anim_effect');
    const streamAnimStepperEl = document.getElementById('nytw_anim_stepper');
    const streamAnimSpeedRowEl = document.getElementById('nytw_stream_anim_speed_row');
    const streamAnimSpeedEl = document.getElementById('nytw_stream_anim_speed');
    const streamAnimSpeedValueEl = document.getElementById('nytw_stream_anim_speed_value');
    const streamAnimSpeedModeControl = document.getElementById('nytw_speed_mode_control');
    const streamAnimSpeedFixedPanel = document.getElementById('nytw_speed_fixed_panel');
    const streamAnimSpeedSyncPanel = document.getElementById('nytw_speed_sync_panel');
    const streamAnimCursorRowEl = document.getElementById('nytw_stream_anim_cursor_row');
    const streamAnimCursorEl = document.getElementById('nytw_stream_anim_cursor');
    const streamAnimCursorConfigEl = document.getElementById('nytw_stream_anim_cursor_config');
    const streamAnimCursorShapeEl = document.getElementById('nytw_stream_anim_cursor_shape');
    const streamAnimCursorAnimEl = document.getElementById('nytw_stream_anim_cursor_anim');
    const streamAnimCursorImageRowEl = document.getElementById('nytw_stream_anim_cursor_image_row');
    const streamAnimCursorImageUrlEl = document.getElementById('nytw_stream_anim_cursor_image_url');

    const textAnimBodyEl = document.getElementById('nytw_text_anim_body');
    const textAnimEnabledEl = document.getElementById('nytw_text_anim_enabled');
    const textAnimConfigEl = document.getElementById('nytw_text_anim_config');
    const textAnimPreviewEl = document.getElementById('nytw_text_anim_preview');
    const textAnimRecentFloorsEl = document.getElementById('nytw_text_anim_recent_floors');
    const textAnimRecentFloorsValueEl = document.getElementById('nytw_text_anim_recent_floors_value');
    const textAnimBodyPreviewEl = document.getElementById('nytw_text_anim_body_preview');
    const textAnimDialoguePreviewEl = document.getElementById('nytw_text_anim_dialogue_preview');
    const textAnimControls = {
        global: {
            panelEl: document.querySelector('[data-text-anim-target="global"]'),
            effectEl: document.getElementById('nytw_text_anim_global_effect'),
            colorEl: document.getElementById('nytw_text_anim_global_color'),
            colorPickerEl: document.getElementById('nytw_text_anim_global_color_picker'),
            intensityEl: document.getElementById('nytw_text_anim_global_intensity'),
            intensityValueEl: document.getElementById('nytw_text_anim_global_intensity_value'),
            periodEl: document.getElementById('nytw_text_anim_global_period'),
            periodValueEl: document.getElementById('nytw_text_anim_global_period_value'),
            effectKey: 'textAnimGlobalEffect',
            colorKey: 'textAnimGlobalColor',
            intensityKey: 'textAnimGlobalIntensity',
            periodKey: 'textAnimGlobalPeriod',
            fallbackColor: '#8ab4ff',
        },
        body: {
            panelEl: document.querySelector('[data-text-anim-target="body"]'),
            overrideEl: document.getElementById('nytw_text_anim_body_override'),
            overrideKey: 'textAnimBodyOverride',
            effectEl: document.getElementById('nytw_text_anim_body_effect'),
            colorEl: document.getElementById('nytw_text_anim_body_color'),
            colorPickerEl: document.getElementById('nytw_text_anim_body_color_picker'),
            intensityEl: document.getElementById('nytw_text_anim_body_intensity'),
            intensityValueEl: document.getElementById('nytw_text_anim_body_intensity_value'),
            periodEl: document.getElementById('nytw_text_anim_body_period'),
            periodValueEl: document.getElementById('nytw_text_anim_body_period_value'),
            previewEl: textAnimBodyPreviewEl,
            effectKey: 'textAnimBodyEffect',
            colorKey: 'textAnimBodyColor',
            intensityKey: 'textAnimBodyIntensity',
            periodKey: 'textAnimBodyPeriod',
            fallbackColor: '#8ab4ff',
        },
        dialogue: {
            panelEl: document.querySelector('[data-text-anim-target="dialogue"]'),
            overrideEl: document.getElementById('nytw_text_anim_dialogue_override'),
            overrideKey: 'textAnimDialogueOverride',
            effectEl: document.getElementById('nytw_text_anim_dialogue_effect'),
            colorEl: document.getElementById('nytw_text_anim_dialogue_color'),
            colorPickerEl: document.getElementById('nytw_text_anim_dialogue_color_picker'),
            intensityEl: document.getElementById('nytw_text_anim_dialogue_intensity'),
            intensityValueEl: document.getElementById('nytw_text_anim_dialogue_intensity_value'),
            periodEl: document.getElementById('nytw_text_anim_dialogue_period'),
            periodValueEl: document.getElementById('nytw_text_anim_dialogue_period_value'),
            previewEl: textAnimDialoguePreviewEl,
            effectKey: 'textAnimDialogueEffect',
            colorKey: 'textAnimDialogueColor',
            intensityKey: 'textAnimDialogueIntensity',
            periodKey: 'textAnimDialoguePeriod',
            fallbackColor: '#ffd27a',
        },
    };

    const readingStyleBodyEl = document.getElementById('nytw_reading_style_body');
    const readingStyleEnabledEl = document.getElementById('nytw_reading_style_enabled');
    const readingStyleResetEl = document.getElementById('nytw_reading_style_reset');
    const readingPreviewEl = document.getElementById('nytw_reading_preview');
    const readingPresetNewEl = document.getElementById('nytw_reading_preset_new');
    const readingPresetSaveEl = document.getElementById('nytw_reading_preset_save');
    const readingPresetSelectEl = document.getElementById('nytw_reading_preset_select');
    const readingPresetDeleteEl = document.getElementById('nytw_reading_preset_delete');
    const readingPresetExportEl = document.getElementById('nytw_reading_preset_export');
    const readingPresetImportEl = document.getElementById('nytw_reading_preset_import');
    const readingPresetFileEl = document.getElementById('nytw_reading_preset_file');

    const typoRowCustomEl = document.getElementById('nytw_typo_row_custom');
    const typoRowLocaleEl = document.getElementById('nytw_typo_row_locale');
    const customWrapEnabledEl = document.getElementById('nytw_custom_font_wrap_enabled');
    const localeFontEnabledEl = document.getElementById('nytw_locale_font_enabled');

    const overallFontSizeEl = document.getElementById('nytw_overall_font_size');
    const overallLetterSpacingEl = document.getElementById('nytw_overall_letter_spacing');
    const overallLineHeightEl = document.getElementById('nytw_overall_line_height');
    const bodyFontSizeEl = document.getElementById('nytw_body_font_size');
    const bodyLetterSpacingEl = document.getElementById('nytw_body_letter_spacing');
    const bodyLineHeightEl = document.getElementById('nytw_body_line_height');
    const dialogueFontSizeEl = document.getElementById('nytw_dialogue_font_size');
    const dialogueLetterSpacingEl = document.getElementById('nytw_dialogue_letter_spacing');
    const dialogueLineHeightEl = document.getElementById('nytw_dialogue_line_height');
    const customFontSizeEl = document.getElementById('nytw_custom_font_size');
    const customLetterSpacingEl = document.getElementById('nytw_custom_letter_spacing');
    const localeFontSizeEl = document.getElementById('nytw_locale_font_size');
    const localeLetterSpacingEl = document.getElementById('nytw_locale_letter_spacing');
    const overallTextColorEl = document.getElementById('nytw_overall_text_color');
    const overallTextColorPickerEl = document.getElementById('nytw_overall_text_color_picker');
    const bodyTextColorEl = document.getElementById('nytw_body_text_color');
    const bodyTextColorPickerEl = document.getElementById('nytw_body_text_color_picker');
    const dialogueTextColorEl = document.getElementById('nytw_dialogue_text_color');
    const dialogueTextColorPickerEl = document.getElementById('nytw_dialogue_text_color_picker');
    const overallParagraphSpacingEl = document.getElementById('nytw_overall_paragraph_spacing');
    const overallTextIndentEl = document.getElementById('nytw_overall_text_indent');
    const bodyParagraphSpacingEl = document.getElementById('nytw_body_paragraph_spacing');
    const bodyTextIndentEl = document.getElementById('nytw_body_text_indent');
    const dialogueParagraphSpacingEl = document.getElementById('nytw_dialogue_paragraph_spacing');
    const dialogueTextIndentEl = document.getElementById('nytw_dialogue_text_indent');
    const overallFontWeightEl = document.getElementById('nytw_overall_font_weight');
    const overallFontStyleEl = document.getElementById('nytw_overall_font_style');
    const bodyFontWeightEl = document.getElementById('nytw_body_font_weight');
    const bodyFontStyleEl = document.getElementById('nytw_body_font_style');
    const dialogueFontWeightEl = document.getElementById('nytw_dialogue_font_weight');
    const dialogueFontStyleEl = document.getElementById('nytw_dialogue_font_style');

    const syncTypographyVisibility = () => {
        const customEnabled = customWrapEnabledEl instanceof HTMLInputElement
            ? customWrapEnabledEl.checked
            : Boolean(settings.customFontWrapEnabled);
        if (typoRowCustomEl) typoRowCustomEl.hidden = !customEnabled;

        const localeEnabled = localeFontEnabledEl instanceof HTMLInputElement
            ? localeFontEnabledEl.checked
            : Boolean(settings.localeFontEnabled);
        if (typoRowLocaleEl) typoRowLocaleEl.hidden = !localeEnabled;
    };

    const pxToNumber = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const num = Number.parseFloat(raw.replace(/px$/i, ''));
        return Number.isFinite(num) ? num : null;
    };

    const formatNumber = (value, decimals) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '';
        const factor = 10 ** Math.max(0, Number(decimals) || 0);
        return String(Math.round(num * factor) / factor);
    };

    const toLetterSpacingEm = (letterSpacingValue, fontSizePx) => {
        const raw = String(letterSpacingValue || '').trim();
        if (!raw) return null;
        if (raw === 'normal') return 0;
        if (/px$/i.test(raw)) {
            const px = pxToNumber(raw);
            if (px === null) return null;
            if (px === 0) return 0;
            if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) return null;
            return px / fontSizePx;
        }
        if (/em$/i.test(raw)) {
            const em = Number.parseFloat(raw);
            return Number.isFinite(em) ? em : null;
        }
        const num = Number.parseFloat(raw);
        return Number.isFinite(num) ? num : null;
    };

    const toLineHeight = (lineHeightValue, fontSizePx) => {
        const raw = String(lineHeightValue || '').trim();
        if (!raw || raw === 'normal') return null;
        if (/px$/i.test(raw)) {
            const px = pxToNumber(raw);
            if (px === null) return null;
            if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) return null;
            return px / fontSizePx;
        }
        if (/em$/i.test(raw)) {
            const em = Number.parseFloat(raw);
            return Number.isFinite(em) ? em : null;
        }
        const num = Number.parseFloat(raw);
        return Number.isFinite(num) ? num : null;
    };

    const readTypographyFromEl = (el) => {
        if (!(el instanceof HTMLElement)) return { fontSizePx: null, letterSpacingEm: null, lineHeight: null };
        const style = getComputedStyle(el);
        const fontSizePx = pxToNumber(style.fontSize);
        const letterSpacingEm = toLetterSpacingEm(style.letterSpacing, fontSizePx);
        const lineHeight = toLineHeight(style.lineHeight, fontSizePx);
        return { fontSizePx, letterSpacingEm, lineHeight };
    };

    const setPlaceholder = (inputEl, text, fallback = '继承') => {
        if (!(inputEl instanceof HTMLInputElement)) return;
        const value = String(text || '').trim();
        inputEl.placeholder = value || fallback;
    };

    const syncTypographyPlaceholders = () => {
        const chatRoot = document.getElementById('chat');
        const bodyProbe = document.querySelector('#chat .mes_text:not(.nytw-stream-buffer)')
            || document.querySelector('#chat .mes_text')
            || (chatRoot instanceof HTMLElement ? chatRoot : null);

        const dialogueProbe = document.querySelector('#chat .mes_text:not(.nytw-stream-buffer) .ny-dialogue, #chat .mes_text:not(.nytw-stream-buffer) .Ny-font-manager')
            || document.querySelector('#chat .mes_text .ny-dialogue, #chat .mes_text .Ny-font-manager')
            || bodyProbe;

        const customProbe = document.querySelector('#chat .mes_text:not(.nytw-stream-buffer) .ny-custom-font')
            || document.querySelector('#chat .mes_text .ny-custom-font')
            || bodyProbe;

        const localeProbe = document.querySelector('#chat .mes_text:not(.nytw-stream-buffer) [data-nytw-locale-font]')
            || document.querySelector('#chat .mes_text [data-nytw-locale-font]')
            || bodyProbe;

        const body = readTypographyFromEl(bodyProbe);
        const dialogue = readTypographyFromEl(dialogueProbe);
        const custom = readTypographyFromEl(customProbe);
        const locale = readTypographyFromEl(localeProbe);

        setPlaceholder(overallFontSizeEl, body.fontSizePx === null ? '' : formatNumber(body.fontSizePx, 2), '继承');
        setPlaceholder(overallLetterSpacingEl, body.letterSpacingEm === null ? '' : formatNumber(body.letterSpacingEm, 2), '继承');
        setPlaceholder(overallLineHeightEl, body.lineHeight === null ? '' : formatNumber(body.lineHeight, 2), '继承');
        setPlaceholder(bodyFontSizeEl, body.fontSizePx === null ? '' : formatNumber(body.fontSizePx, 2), '继承');
        setPlaceholder(bodyLetterSpacingEl, body.letterSpacingEm === null ? '' : formatNumber(body.letterSpacingEm, 2), '继承');
        setPlaceholder(bodyLineHeightEl, body.lineHeight === null ? '' : formatNumber(body.lineHeight, 2), '继承');
        setPlaceholder(dialogueFontSizeEl, dialogue.fontSizePx === null ? '' : formatNumber(dialogue.fontSizePx, 2), '继承');
        setPlaceholder(dialogueLetterSpacingEl, dialogue.letterSpacingEm === null ? '' : formatNumber(dialogue.letterSpacingEm, 2), '继承');
        setPlaceholder(dialogueLineHeightEl, dialogue.lineHeight === null ? '' : formatNumber(dialogue.lineHeight, 2), '继承');
        setPlaceholder(customFontSizeEl, custom.fontSizePx === null ? '' : formatNumber(custom.fontSizePx, 2), '继承');
        setPlaceholder(customLetterSpacingEl, custom.letterSpacingEm === null ? '' : formatNumber(custom.letterSpacingEm, 2), '继承');
        setPlaceholder(localeFontSizeEl, locale.fontSizePx === null ? '' : formatNumber(locale.fontSizePx, 2), '继承');
        setPlaceholder(localeLetterSpacingEl, locale.letterSpacingEm === null ? '' : formatNumber(locale.letterSpacingEm, 2), '继承');
    };

    const debouncedSaveAndApplyTypography = debounce(() => {
        saveSettingsDebounced();
        applyTypographyVariables();
        syncReadingStylePreview();
        syncTypographyPlaceholders();
    }, 200);

    const bindOptionalNumberInput = (inputEl, getValue, setValue, clampFn) => {
        if (!(inputEl instanceof HTMLInputElement)) return;

        const current = getValue();
        inputEl.value = current === null || current === undefined ? '' : String(current);

        inputEl.addEventListener('input', () => {
            setValue(clampFn(inputEl.value));
            debouncedSaveAndApplyTypography();
        });

        inputEl.addEventListener('change', () => {
            const normalized = clampFn(inputEl.value);
            setValue(normalized);
            inputEl.value = normalized === null || normalized === undefined ? '' : String(normalized);
            saveSettingsDebounced();
            applyTypographyVariables();
            syncTypographyPlaceholders();
        });
    };

    const setInputValue = (inputEl, value) => {
        if (!(inputEl instanceof HTMLInputElement)) return;
        inputEl.value = value === null || value === undefined || value === '' ? '' : String(value);
    };

    const setSelectValue = (selectEl, value) => {
        if (!(selectEl instanceof HTMLSelectElement)) return;
        selectEl.value = String(value ?? '');
    };

    const colorTextToPickerValue = (value) => {
        const raw = normalizeOptionalCssColor(value);
        if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
        if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
            return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
        }
        if (/^#[0-9a-fA-F]{8}$/.test(raw)) return raw.slice(0, 7);
        return '#ffffff';
    };

    const byteToHex = (value) => {
        const byte = Math.min(255, Math.max(0, Math.round(Number(value) || 0)));
        return byte.toString(16).padStart(2, '0');
    };

    const cssColorToHex = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';

        const normalized = normalizeOptionalCssColor(raw);
        if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
            return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
        }
        if (/^#[0-9a-fA-F]{8}$/.test(normalized)) return normalized.slice(0, 7).toLowerCase();

        const rgbMatch = raw.match(/^rgba?\(\s*([+-]?\d*\.?\d+)(?:%?)\s*(?:,|\s)\s*([+-]?\d*\.?\d+)(?:%?)\s*(?:,|\s)\s*([+-]?\d*\.?\d+)/i);
        if (rgbMatch) {
            return `#${byteToHex(rgbMatch[1])}${byteToHex(rgbMatch[2])}${byteToHex(rgbMatch[3])}`;
        }

        const srgbMatch = raw.match(/^color\(\s*srgb\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)/i);
        if (srgbMatch) {
            return `#${byteToHex(Number(srgbMatch[1]) * 255)}${byteToHex(Number(srgbMatch[2]) * 255)}${byteToHex(Number(srgbMatch[3]) * 255)}`;
        }

        return '';
    };

    const resolveCssColorToHex = (value) => {
        const direct = cssColorToHex(value);
        if (direct) return direct;
        if (!document.body) return '';

        const probe = document.createElement('span');
        probe.style.position = 'absolute';
        probe.style.width = '0';
        probe.style.height = '0';
        probe.style.overflow = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.color = String(value ?? '').trim();
        document.body.appendChild(probe);
        const resolved = cssColorToHex(getComputedStyle(probe).color);
        probe.remove();
        return resolved;
    };

    const readThemeColor = (varName) => resolveCssColorToHex(`var(${varName})`);

    const readComputedColor = (selectors) => {
        const chatEl = document.getElementById('chat');
        if (!chatEl) return '';
        for (const selector of selectors) {
            const elements = Array.from(chatEl.querySelectorAll(selector));
            for (let i = elements.length - 1; i >= 0; i -= 1) {
                const el = elements[i];
                if (!(el instanceof HTMLElement)) continue;
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const color = cssColorToHex(style.color);
                if (color) return color;
            }
        }
        return '';
    };

    const readCurrentReadingColors = () => {
        const readingStyleActive = Boolean(document.getElementById('nytw-reading-style'));
        return {
            bodyTextColor: (readingStyleActive ? '' : readComputedColor(['.mes_text']))
                || readThemeColor('--SmartThemeBodyColor'),
            dialogueTextColor: (readingStyleActive ? '' : readComputedColor(['.mes_text q', '.mes_text .ny-dialogue', '.mes_text .Ny-font-manager']))
                || readThemeColor('--SmartThemeQuoteColor'),
        };
    };

    const fillCurrentReadingColors = () => {
        const colors = readCurrentReadingColors();
        let changed = false;

        if (!normalizeOptionalCssColor(settings.bodyTextColor) && colors.bodyTextColor) {
            settings.bodyTextColor = colors.bodyTextColor;
            changed = true;
        }
        if (!normalizeOptionalCssColor(settings.dialogueTextColor) && colors.dialogueTextColor) {
            settings.dialogueTextColor = colors.dialogueTextColor;
            changed = true;
        }

        return changed;
    };

    const bindOptionalTextInput = (inputEl, getValue, setValue, normalizeFn) => {
        if (!(inputEl instanceof HTMLInputElement)) return;
        inputEl.value = String(getValue() || '');

        inputEl.addEventListener('input', () => {
            setValue(normalizeFn(inputEl.value));
            debouncedSaveAndApplyTypography();
        });

        inputEl.addEventListener('change', () => {
            const normalized = normalizeFn(inputEl.value);
            setValue(normalized);
            inputEl.value = normalized;
            saveSettingsDebounced();
            applyTypographyVariables();
            syncReadingStylePreview();
            syncTypographyPlaceholders();
        });
    };

    const bindOptionalSelect = (selectEl, getValue, setValue, normalizeFn) => {
        if (!(selectEl instanceof HTMLSelectElement)) return;
        selectEl.value = String(getValue() || '');
        selectEl.addEventListener('change', () => {
            setValue(normalizeFn(selectEl.value));
            selectEl.value = String(getValue() || '');
            saveSettingsDebounced();
            applyTypographyVariables();
            syncReadingStylePreview();
        });
    };

    const bindOptionalColorInput = (textEl, pickerEl, getValue, setValue) => {
        if (textEl instanceof HTMLInputElement) {
            textEl.value = String(getValue() || '');
            textEl.addEventListener('input', () => {
                const normalized = normalizeOptionalCssColor(textEl.value);
                setValue(normalized);
                if (pickerEl instanceof HTMLInputElement && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
                    pickerEl.value = colorTextToPickerValue(normalized);
                }
                debouncedSaveAndApplyTypography();
            });
            textEl.addEventListener('change', () => {
                const normalized = normalizeOptionalCssColor(textEl.value);
                setValue(normalized);
                textEl.value = normalized;
                if (pickerEl instanceof HTMLInputElement) pickerEl.value = colorTextToPickerValue(normalized);
                saveSettingsDebounced();
                applyTypographyVariables();
                syncReadingStylePreview();
            });
        }
        if (pickerEl instanceof HTMLInputElement) {
            pickerEl.value = colorTextToPickerValue(getValue());
            pickerEl.addEventListener('input', () => {
                const normalized = normalizeOptionalCssColor(pickerEl.value);
                setValue(normalized);
                if (textEl instanceof HTMLInputElement) textEl.value = normalized;
                debouncedSaveAndApplyTypography();
            });
        }
    };

    const numberControlBindings = [
        { el: overallFontSizeEl, key: 'overallFontSize', clamp: clampOptionalFontSize },
        { el: overallLetterSpacingEl, key: 'overallLetterSpacing', clamp: clampOptionalLetterSpacing },
        { el: overallLineHeightEl, key: 'overallLineHeight', clamp: clampOptionalLineHeight },
        { el: bodyFontSizeEl, key: 'bodyFontSize', clamp: clampOptionalFontSize },
        { el: bodyLetterSpacingEl, key: 'bodyLetterSpacing', clamp: clampOptionalLetterSpacing },
        { el: bodyLineHeightEl, key: 'lineHeight', clamp: clampOptionalLineHeight },
        { el: dialogueFontSizeEl, key: 'dialogueFontSize', clamp: clampOptionalFontSize },
        { el: dialogueLetterSpacingEl, key: 'dialogueLetterSpacing', clamp: clampOptionalLetterSpacing },
        { el: dialogueLineHeightEl, key: 'dialogueLineHeight', clamp: clampOptionalLineHeight },
        { el: overallParagraphSpacingEl, key: 'overallParagraphSpacing', clamp: clampOptionalParagraphSpacing },
        { el: overallTextIndentEl, key: 'overallTextIndent', clamp: clampOptionalTextIndent },
        { el: bodyParagraphSpacingEl, key: 'bodyParagraphSpacing', clamp: clampOptionalParagraphSpacing },
        { el: bodyTextIndentEl, key: 'bodyTextIndent', clamp: clampOptionalTextIndent },
        { el: dialogueParagraphSpacingEl, key: 'dialogueParagraphSpacing', clamp: clampOptionalParagraphSpacing },
        { el: dialogueTextIndentEl, key: 'dialogueTextIndent', clamp: clampOptionalTextIndent },
        { el: customFontSizeEl, key: 'customFontSize', clamp: clampOptionalFontSize },
        { el: customLetterSpacingEl, key: 'customLetterSpacing', clamp: clampOptionalLetterSpacing },
        { el: localeFontSizeEl, key: 'localeFontSize', clamp: clampOptionalFontSize },
        { el: localeLetterSpacingEl, key: 'localeLetterSpacing', clamp: clampOptionalLetterSpacing },
    ];

    const colorControlBindings = [
        { textEl: overallTextColorEl, pickerEl: overallTextColorPickerEl, key: 'overallTextColor' },
        { textEl: bodyTextColorEl, pickerEl: bodyTextColorPickerEl, key: 'bodyTextColor' },
        { textEl: dialogueTextColorEl, pickerEl: dialogueTextColorPickerEl, key: 'dialogueTextColor' },
    ];

    const selectControlBindings = [
        { el: overallFontWeightEl, key: 'overallFontWeight', normalize: normalizeOptionalFontWeight },
        { el: overallFontStyleEl, key: 'overallFontStyle', normalize: normalizeOptionalFontStyle },
        { el: bodyFontWeightEl, key: 'bodyFontWeight', normalize: normalizeOptionalFontWeight },
        { el: bodyFontStyleEl, key: 'bodyFontStyle', normalize: normalizeOptionalFontStyle },
        { el: dialogueFontWeightEl, key: 'dialogueFontWeight', normalize: normalizeOptionalFontWeight },
        { el: dialogueFontStyleEl, key: 'dialogueFontStyle', normalize: normalizeOptionalFontStyle },
    ];

    const syncReadingPresetSelect = (selectedId = '') => {
        if (!(readingPresetSelectEl instanceof HTMLSelectElement)) return;
        normalizeReadingStylePresets();
        const current = selectedId || readingPresetSelectEl.value;
        readingPresetSelectEl.innerHTML = '<option value="">当前样式</option>';
        for (const preset of settings.readingStylePresets) {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            readingPresetSelectEl.appendChild(option);
        }
        readingPresetSelectEl.value = settings.readingStylePresets.some((preset) => preset.id === current) ? current : '';
    };

    const buildUniqueReadingPresetName = () => {
        normalizeReadingStylePresets();
        const usedNames = new Set(settings.readingStylePresets.map((preset) => preset.name));
        let index = settings.readingStylePresets.length + 1;
        let name = `阅读样式 ${index}`;
        while (usedNames.has(name)) {
            index += 1;
            name = `阅读样式 ${index}`;
        }
        return name;
    };

    const syncReadingStyleControls = () => {
        if (readingStyleEnabledEl instanceof HTMLInputElement) {
            readingStyleEnabledEl.checked = settings.readingStyleEnabled === true;
        }
        if (readingStyleBodyEl) {
            readingStyleBodyEl.classList.toggle('is-disabled', settings.readingStyleEnabled !== true);
        }
        for (const binding of numberControlBindings) {
            setInputValue(binding.el, normalizeReadingStyleValue(binding.key, settings[binding.key]));
        }
        for (const binding of colorControlBindings) {
            const value = normalizeOptionalCssColor(settings[binding.key]);
            if (binding.textEl instanceof HTMLInputElement) binding.textEl.value = value;
            if (binding.pickerEl instanceof HTMLInputElement) binding.pickerEl.value = colorTextToPickerValue(value);
        }
        for (const binding of selectControlBindings) {
            setSelectValue(binding.el, binding.normalize(settings[binding.key]));
        }
        syncReadingPresetSelect();
        syncReadingStylePreview();
    };

    const firstResolved = (...values) => {
        for (const value of values) {
            if (value === null || value === undefined || value === '') continue;
            return value;
        }
        return null;
    };

    const setPreviewStyle = (el, name, value, unit = '') => {
        if (!(el instanceof HTMLElement)) return;
        if (value === null || value === undefined || value === '') {
            el.style.removeProperty(name);
            return;
        }
        el.style.setProperty(name, `${value}${unit}`);
    };

    const syncReadingStylePreview = () => {
        if (!readingPreviewEl) return;
        const enabled = settings.readingStyleEnabled === true;
        readingPreviewEl.classList.toggle('is-disabled', !enabled);

        const bodyEl = readingPreviewEl.querySelector('.nytw-reading-preview-body');
        const dialogueEl = readingPreviewEl.querySelector('.nytw-reading-preview-dialogue');
        if (!(bodyEl instanceof HTMLElement) || !(dialogueEl instanceof HTMLElement)) return;

        const bodyFontSize = firstResolved(settings.bodyFontSize, settings.overallFontSize);
        const bodyLetterSpacing = firstResolved(settings.bodyLetterSpacing, settings.overallLetterSpacing);
        const bodyLineHeight = firstResolved(settings.lineHeight, settings.overallLineHeight);
        const bodyColor = firstResolved(settings.bodyTextColor, settings.overallTextColor);
        const bodyParagraphSpacing = firstResolved(settings.bodyParagraphSpacing, settings.overallParagraphSpacing);
        const bodyTextIndent = firstResolved(settings.bodyTextIndent, settings.overallTextIndent);
        const bodyFontWeight = firstResolved(settings.bodyFontWeight, settings.overallFontWeight);
        const bodyFontStyle = firstResolved(settings.bodyFontStyle, settings.overallFontStyle);

        const dialogueFontSize = firstResolved(settings.dialogueFontSize, bodyFontSize);
        const dialogueLetterSpacing = firstResolved(settings.dialogueLetterSpacing, bodyLetterSpacing);
        const dialogueLineHeight = firstResolved(settings.dialogueLineHeight, bodyLineHeight);
        const dialogueColor = firstResolved(settings.dialogueTextColor, bodyColor);
        const dialogueParagraphSpacing = firstResolved(settings.dialogueParagraphSpacing, bodyParagraphSpacing);
        const dialogueTextIndent = firstResolved(settings.dialogueTextIndent, bodyTextIndent);
        const dialogueFontWeight = firstResolved(settings.dialogueFontWeight, bodyFontWeight);
        const dialogueFontStyle = firstResolved(settings.dialogueFontStyle, bodyFontStyle);

        setPreviewStyle(bodyEl, 'font-size', enabled ? bodyFontSize : null, 'px');
        setPreviewStyle(bodyEl, 'letter-spacing', enabled ? bodyLetterSpacing : null, 'em');
        setPreviewStyle(bodyEl, 'line-height', enabled ? bodyLineHeight : null);
        setPreviewStyle(bodyEl, 'color', enabled ? bodyColor : null);
        setPreviewStyle(bodyEl, 'margin-block', enabled ? bodyParagraphSpacing : null, 'em');
        setPreviewStyle(bodyEl, 'text-indent', enabled ? bodyTextIndent : null, 'em');
        setPreviewStyle(bodyEl, 'font-weight', enabled ? bodyFontWeight : null);
        setPreviewStyle(bodyEl, 'font-style', enabled ? bodyFontStyle : null);

        setPreviewStyle(dialogueEl, 'font-size', enabled ? dialogueFontSize : null, 'px');
        setPreviewStyle(dialogueEl, 'letter-spacing', enabled ? dialogueLetterSpacing : null, 'em');
        setPreviewStyle(dialogueEl, 'line-height', enabled ? dialogueLineHeight : null);
        setPreviewStyle(dialogueEl, 'color', enabled ? dialogueColor : null);
        setPreviewStyle(dialogueEl, 'margin-block', enabled ? dialogueParagraphSpacing : null, 'em');
        setPreviewStyle(dialogueEl, 'padding-left', enabled ? dialogueTextIndent : null, 'em');
        setPreviewStyle(dialogueEl, 'font-weight', enabled ? dialogueFontWeight : null);
        setPreviewStyle(dialogueEl, 'font-style', enabled ? dialogueFontStyle : null);
    };

    const applyReadingStyleNow = () => {
        saveSettingsDebounced();
        applyTypographyVariables();
        syncReadingStyleControls();
        syncTypographyPlaceholders();
    };

    const resetReadingStyle = () => {
        const keepEnabled = settings.readingStyleEnabled === true;
        applyReadingStyleSnapshot({
            readingStyleEnabled: keepEnabled,
            overallFontSize: null,
            overallLetterSpacing: null,
            overallLineHeight: null,
            overallTextColor: '',
            overallParagraphSpacing: null,
            overallTextIndent: null,
            overallFontWeight: '',
            overallFontStyle: '',
            bodyFontSize: null,
            bodyLetterSpacing: null,
            lineHeight: null,
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
            customFontSize: null,
            customLetterSpacing: null,
            localeFontSize: null,
            localeLetterSpacing: null,
        });
        if (keepEnabled) fillCurrentReadingColors();
        applyReadingStyleNow();
        notify('success', '阅读样式已重置。');
    };

    const toCssUrlValue = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return 'none';
        const escaped = raw
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\r\n\f]/g, '');
        return `url("${escaped}")`;
    };

    const textAnimColorToPickerValue = (value, fallbackColor = '#8ab4ff') => {
        const normalized = normalizeTextAnimColor(value);
        return normalized ? colorTextToPickerValue(normalized) : fallbackColor;
    };

    const getTextAnimValues = (config) => {
        const effect = normalizeTextAnimEffect(settings[config.effectKey]);
        const color = normalizeTextAnimColor(settings[config.colorKey]);
        const intensity = clampTextAnimIntensity(settings[config.intensityKey]);
        const period = clampTextAnimPeriod(settings[config.periodKey]);

        settings[config.effectKey] = effect;
        settings[config.colorKey] = color;
        settings[config.intensityKey] = intensity;
        settings[config.periodKey] = period;

        return { effect, color, intensity, period };
    };

    const getResolvedTextAnimValues = (target) => {
        const normalizedTarget = target === 'dialogue' ? 'dialogue' : 'body';
        const config = textAnimControls[normalizedTarget];
        const globalValues = getTextAnimValues(textAnimControls.global);
        const usesOverride = config?.overrideKey
            ? settings[config.overrideKey] === true
            : true;

        return usesOverride ? getTextAnimValues(config) : globalValues;
    };

    const setTextAnimControlDisabled = (config, disabled) => {
        [
            config.effectEl,
            config.colorEl,
            config.colorPickerEl,
            config.intensityEl,
            config.periodEl,
        ].forEach((el) => {
            if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
                el.disabled = disabled;
            }
        });
    };

    const syncTextAnimPreviewTarget = (el, enabled, values) => {
        if (!(el instanceof HTMLElement)) return;

        const { effect, color, intensity, period } = values;
        const shadowPx = intensity <= 0 ? 0 : Math.round(intensity * 1.6) / 10;
        const shadowSoftPx = Math.round(shadowPx * 0.55 * 10) / 10;
        const shadowDeepPx = Math.round(shadowPx * 1.55 * 10) / 10;
        const shiftPx = intensity <= 0 ? 0 : Math.max(0.4, Math.round(intensity * 0.025 * 10) / 10);
        const shiftSoftPx = shiftPx ? Math.round(shiftPx * 0.6 * 10) / 10 : 0;
        const dim = Math.max(0.86, 1 - (intensity * 0.0018));
        const veil = Math.max(0.52, 1 - (intensity * 0.006));

        if (!enabled || effect === 'none') {
            el.removeAttribute('data-nytw-text-anim');
        } else {
            el.setAttribute('data-nytw-text-anim', effect);
        }
        el.style.setProperty('--nytw-text-anim-color', color || 'currentColor');
        el.style.setProperty('--nytw-text-anim-power', String(intensity / 100));
        el.style.setProperty('--nytw-text-anim-cycle', `${period}s`);
        el.style.setProperty('--nytw-text-anim-shadow', `${shadowPx}px`);
        el.style.setProperty('--nytw-text-anim-shadow-soft', `${shadowSoftPx}px`);
        el.style.setProperty('--nytw-text-anim-shadow-deep', `${shadowDeepPx}px`);
        el.style.setProperty('--nytw-text-anim-shift', `${shiftPx}px`);
        el.style.setProperty('--nytw-text-anim-shift-neg', shiftPx ? `-${shiftPx}px` : '0px');
        el.style.setProperty('--nytw-text-anim-shift-soft', `${shiftSoftPx}px`);
        el.style.setProperty('--nytw-text-anim-shift-soft-neg', shiftSoftPx ? `-${shiftSoftPx}px` : '0px');
        el.style.setProperty('--nytw-text-anim-dim', String(Math.round(dim * 1000) / 1000));
        el.style.setProperty('--nytw-text-anim-veil', String(Math.round(veil * 1000) / 1000));
    };

    const syncTextAnimUi = ({ preserveColorTarget = '' } = {}) => {
        settings.textAnimEnabled = settings.textAnimEnabled === true;
        const enabled = settings.textAnimEnabled === true;

        if (textAnimEnabledEl instanceof HTMLInputElement) textAnimEnabledEl.checked = enabled;
        if (textAnimBodyEl) textAnimBodyEl.classList.toggle('is-disabled', !enabled);
        if (textAnimConfigEl instanceof HTMLElement) textAnimConfigEl.classList.toggle('is-disabled', !enabled);

        const recentFloors = clampTextAnimRecentFloors(settings.textAnimRecentFloors);
        settings.textAnimRecentFloors = recentFloors;
        if (textAnimRecentFloorsEl instanceof HTMLInputElement) {
            textAnimRecentFloorsEl.value = String(recentFloors);
            textAnimRecentFloorsEl.disabled = !enabled;
        }
        if (textAnimRecentFloorsValueEl) textAnimRecentFloorsValueEl.textContent = `${recentFloors}层`;

        for (const [target, config] of Object.entries(textAnimControls)) {
            if (config.overrideKey) {
                settings[config.overrideKey] = settings[config.overrideKey] === true;
                if (config.overrideEl instanceof HTMLInputElement) {
                    config.overrideEl.checked = settings[config.overrideKey] === true;
                    config.overrideEl.disabled = !enabled;
                }
            }

            const values = getTextAnimValues(config);
            if (config.effectEl instanceof HTMLSelectElement) config.effectEl.value = values.effect;
            if (config.colorEl instanceof HTMLInputElement && preserveColorTarget !== target) config.colorEl.value = values.color;
            if (config.colorPickerEl instanceof HTMLInputElement) {
                config.colorPickerEl.value = textAnimColorToPickerValue(values.color, config.fallbackColor);
            }
            if (config.intensityEl instanceof HTMLInputElement) config.intensityEl.value = String(values.intensity);
            if (config.periodEl instanceof HTMLInputElement) config.periodEl.value = String(values.period);
            if (config.intensityValueEl) config.intensityValueEl.textContent = `${values.intensity}%`;
            if (config.periodValueEl) config.periodValueEl.textContent = `${values.period}s`;

            const followsGlobal = Boolean(config.overrideKey && settings[config.overrideKey] !== true);
            if (config.panelEl instanceof HTMLElement) {
                config.panelEl.classList.toggle('is-following-global', followsGlobal);
            }
            setTextAnimControlDisabled(config, !enabled || followsGlobal);
        }

        syncTextAnimPreviewTarget(textAnimBodyPreviewEl, enabled, getResolvedTextAnimValues('body'));
        syncTextAnimPreviewTarget(textAnimDialoguePreviewEl, enabled, getResolvedTextAnimValues('dialogue'));
    };

    const applyTextAnimSettings = ({ debounced = false, preserveColorTarget = '' } = {}) => {
        syncTextAnimUi({ preserveColorTarget });
        if (debounced) {
            debouncedSaveAndApplyTextAnim();
            return;
        }
        saveSettingsDebounced();
        scheduleScan({ full: true });
    };

    const debouncedSaveAndApplyTextAnim = debounce(() => {
        saveSettingsDebounced();
        scheduleScan({ full: true });
    }, 180);

    const syncStreamAnimUi = () => {
        const mode = normalizeStreamRenderMode(settings.streamRenderMode);
        const isBuffer = mode === 'buffer';

        if (streamAnimSectionEl) {
            streamAnimSectionEl.classList.toggle('is-disabled', !isBuffer);
        }

        const effect = normalizeStreamAnimEffect(settings.streamAnimEffect);
        const cursorEnabled = true; // Always enable cursor
        const cursorShape = normalizeStreamCursorShape(settings.streamAnimCursorShape);
        const cursorAnim = normalizeStreamCursorAnim(settings.streamAnimCursorAnim);
        const cursorImageUrl = normalizeStreamCursorImageUrl(settings.streamAnimCursorImageUrl);
        const cursorShapeIconMap = {
            bar: '|',
            thin: '│',
            block: '█',
            hollow: '□',
            underscore: '_',
            image: '▣',
        };

        if (streamAnimEffectEl && (streamAnimEffectEl instanceof HTMLSelectElement || streamAnimEffectEl instanceof HTMLInputElement)) {
            streamAnimEffectEl.value = effect;
        }
        if (streamAnimCursorShapeEl instanceof HTMLSelectElement) {
            streamAnimCursorShapeEl.value = cursorShape;
        }
        if (streamAnimCursorAnimEl instanceof HTMLSelectElement) {
            streamAnimCursorAnimEl.value = cursorAnim;
        }
        if (streamAnimCursorImageUrlEl instanceof HTMLInputElement) {
            streamAnimCursorImageUrlEl.value = cursorImageUrl;
        }

        // Stepper UI Sync
        if (streamAnimStepperEl) {
            const previewContainer = document.getElementById('nytw_anim_preview_container');
            if (previewContainer) {
                // Check for existing content to transition
                const oldWrapper = previewContainer.querySelector('.nytw-anim-wrapper:not(.nytw-anim-exit)');

                // Name map
                const effectNames = {
                    'none': '关闭',
                    'typewriter': '打字机',
                    'blur': '模糊显现',
                    'glow': '流光浮现'
                };
                
                // Create new wrapper structure
                const newWrapper = document.createElement('div');
                newWrapper.className = 'nytw-anim-wrapper';
                // Only animate if we are replacing something
                if (oldWrapper) {
                    newWrapper.classList.add('nytw-anim-enter');
                }
                
                // Create preview element
                const previewEl = document.createElement('div');
                previewEl.className = `nytw-anim-preview preview-${effect}`;
                // Only some effects need text span
                if (effect !== 'none') {
                    const span = document.createElement('span');
                    span.textContent = 'Aa';
                    previewEl.appendChild(span);
                }
                if (effect === 'typewriter') {
                    previewEl.dataset.cursorEnabled = cursorEnabled ? '1' : '0';
                    previewEl.dataset.cursorShape = cursorShape;
                    previewEl.dataset.cursorAnim = cursorAnim;
                    previewEl.style.setProperty('--nytw-preview-cursor-image', toCssUrlValue(cursorImageUrl));
                }
                
                const labelEl = document.createElement('div');
                labelEl.className = 'nytw-anim-label';
                labelEl.textContent = effectNames[effect] || effect;
                
                newWrapper.appendChild(previewEl);
                newWrapper.appendChild(labelEl);

                // Transition logic
                if (oldWrapper) {
                    // Animate old out
                    oldWrapper.classList.remove('nytw-anim-enter');
                    oldWrapper.classList.add('nytw-anim-exit');
                    
                    oldWrapper.addEventListener('animationend', () => oldWrapper.remove());
                    // Fallback
                    setTimeout(() => { if (oldWrapper.parentNode) oldWrapper.remove(); }, 350);
                    
                    previewContainer.appendChild(newWrapper);
                } else {
                    // Initial render (no animation or simple render)
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(newWrapper);
                }
            }
        }

        const showTypewriter = effect === 'typewriter';
        if (streamAnimSpeedRowEl) streamAnimSpeedRowEl.style.display = showTypewriter ? '' : 'none';
        if (streamAnimCursorRowEl) streamAnimCursorRowEl.style.display = showTypewriter ? '' : 'none';
        if (streamAnimCursorImageRowEl) {
            streamAnimCursorImageRowEl.style.display = (showTypewriter && cursorShape === 'image') ? '' : 'none';
        }

        // Speed UI Sync
        const currentSpeed = settings.streamAnimSpeed;
        const isSyncMode = currentSpeed <= 0;
        const displaySpeed = isSyncMode ? (streamAnimSpeedEl ? clampStreamAnimSpeed(streamAnimSpeedEl.value) : 20) : clampStreamAnimSpeed(currentSpeed);

        // 1. Segmented Control Active State
        if (streamAnimSpeedModeControl) {
            const options = streamAnimSpeedModeControl.querySelectorAll('.nytw-segment-option');
            options.forEach(opt => {
                if (opt.dataset.value === (isSyncMode ? 'sync' : 'fixed')) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });
        }

        // 2. Panel Visibility
        if (streamAnimSpeedFixedPanel) streamAnimSpeedFixedPanel.style.display = isSyncMode ? 'none' : '';
        if (streamAnimSpeedSyncPanel) streamAnimSpeedSyncPanel.style.display = isSyncMode ? '' : 'none';

        // 3. Update Range Input & Label if in Fixed Mode
        if (!isSyncMode) {
            if (streamAnimSpeedEl instanceof HTMLInputElement) {
                streamAnimSpeedEl.value = String(displaySpeed);
            }
            if (streamAnimSpeedValueEl) {
                streamAnimSpeedValueEl.textContent = `${displaySpeed}ms/字`;
            }
        }

        if (streamAnimCursorEl instanceof HTMLInputElement) {
            streamAnimCursorEl.checked = cursorEnabled;
        }

        if (streamAnimHintEl) {
            streamAnimHintEl.textContent = isBuffer
                ? ''
                : '切换为“实时显示”后可启用流式动画效果。';
        }
    };

    const applyRenderMode = (mode) => {
        settings.streamRenderMode = normalizeStreamRenderMode(mode);
        syncRenderModeUi(settings.streamRenderMode);
        syncStreamAnimUi();
        saveSettingsDebounced();
        queueApplyFonts();
        scheduleScan({ full: true });
    };

    syncRenderModeUi(settings.streamRenderMode);
    syncStreamAnimUi();
    syncTextAnimUi();
    normalizeReadingStylePresets();
    if (settings.readingStyleEnabled === true && fillCurrentReadingColors()) {
        saveSettingsDebounced();
        applyTypographyVariables();
    }
    syncReadingStyleControls();
    syncTypographyVisibility();
    syncTypographyPlaceholders();
    
    // Listeners for Select elements
    renderModeSelectEls.forEach((el) => {
        el.addEventListener('change', () => applyRenderMode(el.value));
    });

    // Listeners for Segmented Control
    const controlContainer = document.getElementById('nytw_render_mode_control');
    if (controlContainer) {
        const options = controlContainer.querySelectorAll('.nytw-segment-option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                applyRenderMode(opt.dataset.value);
            });
        });
    }

    // Stream animation controls (Stepper Logic)
    if (streamAnimStepperEl) {
        const effects = ['none', 'typewriter', 'blur', 'glow'];
        
        const changeEffect = (direction) => {
            const currentEffect = normalizeStreamAnimEffect(settings.streamAnimEffect);
            let index = effects.indexOf(currentEffect);
            if (index === -1) index = 0;
            
            if (direction === 'next') {
                index = (index + 1) % effects.length;
            } else {
                index = (index - 1 + effects.length) % effects.length;
            }
            
            settings.streamAnimEffect = effects[index];
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        };

        const prevBtn = streamAnimStepperEl.querySelector('.prev');
        const nextBtn = streamAnimStepperEl.querySelector('.next');
        
        if (prevBtn) prevBtn.addEventListener('click', () => changeEffect('prev'));
        if (nextBtn) nextBtn.addEventListener('click', () => changeEffect('next'));
    }

    if (streamAnimEffectEl instanceof HTMLSelectElement) {
        streamAnimEffectEl.addEventListener('change', () => {
            settings.streamAnimEffect = normalizeStreamAnimEffect(streamAnimEffectEl.value);
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        });
    }

    if (streamAnimSpeedModeControl) {
        const options = streamAnimSpeedModeControl.querySelectorAll('.nytw-segment-option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                const mode = opt.dataset.value;
                if (mode === 'sync') {
                    settings.streamAnimSpeed = 0;
                } else {
                    // Switch to fixed: recover value from slider or default
                    if (streamAnimSpeedEl instanceof HTMLInputElement) {
                        settings.streamAnimSpeed = clampStreamAnimSpeed(streamAnimSpeedEl.value);
                    } else {
                        settings.streamAnimSpeed = 20;
                    }
                }
                syncStreamAnimUi();
                saveSettingsDebounced();
                scheduleScan({ full: false });
            });
        });
    }

    if (streamAnimSpeedEl instanceof HTMLInputElement) {
        const updateSpeed = () => {
            const speed = clampStreamAnimSpeed(streamAnimSpeedEl.value);
            settings.streamAnimSpeed = speed;
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        };

        streamAnimSpeedEl.addEventListener('input', updateSpeed);
        streamAnimSpeedEl.addEventListener('change', updateSpeed);
    }

    if (streamAnimCursorEl instanceof HTMLInputElement) {
        streamAnimCursorEl.addEventListener('change', () => {
            settings.streamAnimCursor = streamAnimCursorEl.checked;
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        });
    }

    if (streamAnimCursorShapeEl instanceof HTMLSelectElement) {
        streamAnimCursorShapeEl.addEventListener('change', () => {
            settings.streamAnimCursorShape = normalizeStreamCursorShape(streamAnimCursorShapeEl.value);
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        });
    }

    if (streamAnimCursorAnimEl instanceof HTMLSelectElement) {
        streamAnimCursorAnimEl.addEventListener('change', () => {
            settings.streamAnimCursorAnim = normalizeStreamCursorAnim(streamAnimCursorAnimEl.value);
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        });
    }

    if (streamAnimCursorImageUrlEl instanceof HTMLInputElement) {
        const updateCursorImageUrl = () => {
            settings.streamAnimCursorImageUrl = normalizeStreamCursorImageUrl(streamAnimCursorImageUrlEl.value);
            syncStreamAnimUi();
            saveSettingsDebounced();
            scheduleScan({ full: false });
        };
        streamAnimCursorImageUrlEl.addEventListener('input', updateCursorImageUrl);
        streamAnimCursorImageUrlEl.addEventListener('change', updateCursorImageUrl);
    }

    if (textAnimEnabledEl instanceof HTMLInputElement) {
        textAnimEnabledEl.addEventListener('change', () => {
            settings.textAnimEnabled = textAnimEnabledEl.checked;
            applyTextAnimSettings();
        });
    }

    if (textAnimRecentFloorsEl instanceof HTMLInputElement) {
        textAnimRecentFloorsEl.addEventListener('input', () => {
            settings.textAnimRecentFloors = clampTextAnimRecentFloors(textAnimRecentFloorsEl.value);
            applyTextAnimSettings({ debounced: true });
        });
        textAnimRecentFloorsEl.addEventListener('change', () => {
            settings.textAnimRecentFloors = clampTextAnimRecentFloors(textAnimRecentFloorsEl.value);
            applyTextAnimSettings();
        });
    }

    for (const [target, config] of Object.entries(textAnimControls)) {
        if (config.overrideEl instanceof HTMLInputElement && config.overrideKey) {
            config.overrideEl.addEventListener('change', () => {
                settings[config.overrideKey] = config.overrideEl.checked;
                applyTextAnimSettings();
            });
        }

        if (config.effectEl instanceof HTMLSelectElement) {
            config.effectEl.addEventListener('change', () => {
                settings[config.effectKey] = normalizeTextAnimEffect(config.effectEl.value);
                applyTextAnimSettings();
            });
        }

        if (config.colorEl instanceof HTMLInputElement) {
            config.colorEl.addEventListener('input', () => {
                settings[config.colorKey] = normalizeTextAnimColor(config.colorEl.value);
                applyTextAnimSettings({ debounced: true, preserveColorTarget: target });
            });
            config.colorEl.addEventListener('change', () => {
                settings[config.colorKey] = normalizeTextAnimColor(config.colorEl.value);
                if (config.colorEl instanceof HTMLInputElement) config.colorEl.value = settings[config.colorKey];
                applyTextAnimSettings();
            });
        }

        if (config.colorPickerEl instanceof HTMLInputElement) {
            config.colorPickerEl.addEventListener('input', () => {
                settings[config.colorKey] = normalizeTextAnimColor(config.colorPickerEl.value);
                applyTextAnimSettings({ debounced: true });
            });
            config.colorPickerEl.addEventListener('change', () => {
                settings[config.colorKey] = normalizeTextAnimColor(config.colorPickerEl.value);
                applyTextAnimSettings();
            });
        }

        if (config.intensityEl instanceof HTMLInputElement) {
            config.intensityEl.addEventListener('input', () => {
                settings[config.intensityKey] = clampTextAnimIntensity(config.intensityEl.value);
                applyTextAnimSettings({ debounced: true });
            });
            config.intensityEl.addEventListener('change', () => {
                settings[config.intensityKey] = clampTextAnimIntensity(config.intensityEl.value);
                applyTextAnimSettings();
            });
        }

        if (config.periodEl instanceof HTMLInputElement) {
            config.periodEl.addEventListener('input', () => {
                settings[config.periodKey] = clampTextAnimPeriod(config.periodEl.value);
                applyTextAnimSettings({ debounced: true });
            });
            config.periodEl.addEventListener('change', () => {
                settings[config.periodKey] = clampTextAnimPeriod(config.periodEl.value);
                applyTextAnimSettings();
            });
        }
    }

    // Reading style controls
    if (readingStyleEnabledEl instanceof HTMLInputElement) {
        readingStyleEnabledEl.addEventListener('change', () => {
            const willEnable = readingStyleEnabledEl.checked;
            if (willEnable && settings.readingStyleEnabled !== true) fillCurrentReadingColors();
            settings.readingStyleEnabled = readingStyleEnabledEl.checked;
            applyReadingStyleNow();
        });
    }

    readingStyleResetEl?.addEventListener('click', resetReadingStyle);

    for (const binding of numberControlBindings) {
        bindOptionalNumberInput(
            binding.el,
            () => settings[binding.key],
            (v) => { settings[binding.key] = v; },
            binding.clamp,
        );
    }

    for (const binding of colorControlBindings) {
        bindOptionalColorInput(
            binding.textEl,
            binding.pickerEl,
            () => settings[binding.key],
            (v) => { settings[binding.key] = v; },
        );
    }

    for (const binding of selectControlBindings) {
        bindOptionalSelect(
            binding.el,
            () => settings[binding.key],
            (v) => { settings[binding.key] = v; },
            binding.normalize,
        );
    }

    readingPresetNewEl?.addEventListener('click', () => {
        const defaultName = buildUniqueReadingPresetName();
        const inputName = window.prompt('请输入阅读样式预设名称：', defaultName);
        if (inputName === null) return;

        const name = String(inputName).trim().slice(0, 80);
        if (!name) {
            notify('warning', '预设名称不能为空。');
            return;
        }

        if (settings.readingStylePresets.some((preset) => preset.name === name)) {
            notify('warning', `已存在同名阅读样式预设：${name}`);
            return;
        }

        const now = new Date().toISOString();
        const preset = {
            id: buildPresetId(),
            name,
            createdAt: now,
            updatedAt: now,
            style: getReadingStyleSnapshot(),
        };
        upsertReadingStylePreset(preset);
        saveSettingsDebounced();
        syncReadingPresetSelect(preset.id);
        notify('success', `已新建阅读样式预设：${name}`);
    });

    readingPresetSaveEl?.addEventListener('click', () => {
        const presetId = readingPresetSelectEl instanceof HTMLSelectElement ? readingPresetSelectEl.value : '';
        const existing = settings.readingStylePresets.find((item) => item.id === presetId);
        if (!existing) {
            notify('warning', '请先选择一个要保存的阅读样式预设，或点击“新建预设”。');
            return;
        }
        const preset = {
            ...existing,
            updatedAt: new Date().toISOString(),
            style: getReadingStyleSnapshot(),
        };
        upsertReadingStylePreset(preset);
        saveSettingsDebounced();
        syncReadingPresetSelect(preset.id);
        notify('success', `已保存阅读样式预设：${preset.name}`);
    });

    readingPresetSelectEl?.addEventListener('change', () => {
        const presetId = readingPresetSelectEl instanceof HTMLSelectElement ? readingPresetSelectEl.value : '';
        if (!presetId) return;
        const preset = settings.readingStylePresets.find((item) => item.id === presetId);
        if (!preset) return;
        applyReadingStyleSnapshot(preset.style);
        applyReadingStyleNow();
        syncReadingPresetSelect(preset.id);
        notify('success', `已读取阅读样式预设：${preset.name}`);
    });

    readingPresetDeleteEl?.addEventListener('click', () => {
        const presetId = readingPresetSelectEl instanceof HTMLSelectElement ? readingPresetSelectEl.value : '';
        const preset = settings.readingStylePresets.find((item) => item.id === presetId);
        if (!preset) {
            notify('warning', '请先选择一个要删除的阅读样式预设。');
            return;
        }
        settings.readingStylePresets = settings.readingStylePresets.filter((item) => item.id !== presetId);
        saveSettingsDebounced();
        syncReadingPresetSelect('');
        notify('success', `已删除阅读样式预设：${preset.name}`);
    });

    readingPresetExportEl?.addEventListener('click', () => {
        const presetId = readingPresetSelectEl instanceof HTMLSelectElement ? readingPresetSelectEl.value : '';
        const selected = settings.readingStylePresets.find((item) => item.id === presetId);
        const name = selected?.name || '当前阅读样式';
        const payload = {
            schema: READING_STYLE_PRESET_SCHEMA,
            version: READING_STYLE_PRESET_VERSION,
            exportedAt: new Date().toISOString(),
            name,
            style: cloneJsonValue(selected?.style || getReadingStyleSnapshot()),
        };
        downloadJsonFile(buildPresetExportFileName(name), payload);
        notify('success', `已导出阅读样式预设：${name}`);
    });

    readingPresetImportEl?.addEventListener('click', () => {
        if (readingPresetFileEl instanceof HTMLInputElement) {
            readingPresetFileEl.value = '';
            readingPresetFileEl.click();
        }
    });

    readingPresetFileEl?.addEventListener('change', async () => {
        const file = readingPresetFileEl instanceof HTMLInputElement ? readingPresetFileEl.files?.[0] : null;
        if (!file) return;
        try {
            const preset = parseReadingStylePresetPayload(await readFileAsText(file));
            preset.id = buildPresetId();
            preset.updatedAt = new Date().toISOString();
            upsertReadingStylePreset(preset);
            applyReadingStyleSnapshot(preset.style);
            saveSettingsDebounced();
            applyTypographyVariables();
            syncReadingStyleControls();
            syncReadingPresetSelect(preset.id);
            notify('success', `已导入并读取阅读样式预设：${preset.name}`);
        } catch (error) {
            console.error('[NyTW] Failed to import reading style preset', error);
            notify('error', `阅读样式预设导入失败：${error?.message || error}`);
        } finally {
            if (readingPresetFileEl instanceof HTMLInputElement) readingPresetFileEl.value = '';
        }
    });

    const attachVisibilityToggle = (inputEl) => {
        if (!(inputEl instanceof HTMLInputElement)) return;
        inputEl.addEventListener('change', () => {
            syncTypographyVisibility();
            syncTypographyPlaceholders();
        });
    };
    attachVisibilityToggle(customWrapEnabledEl);
    attachVisibilityToggle(localeFontEnabledEl);

    // Stepper buttons handler
    document.querySelectorAll('.nytw-stepper-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const wrapper = btn.closest('.nytw-stepper');
            if (!wrapper) return;
            const input = wrapper.querySelector('input');
            if (!input) return;

            const isPlus = btn.classList.contains('plus');
            const step = Number(input.step) || 1;
            
            let currentVal = Number.parseFloat(input.value);
            
            if (isNaN(currentVal)) {
                currentVal = Number.parseFloat(input.placeholder);
                if (isNaN(currentVal)) {
                    if (/line[_-]height/i.test(input.id)) currentVal = 1.6;
                    else if (input.id.includes('spacing') || input.id.includes('indent')) currentVal = 0;
                    else currentVal = 16;
                }
            }

            const getPrecision = (n) => (String(n).split('.')[1] || '').length;
            const precision = Math.max(getPrecision(currentVal), getPrecision(step));
            const factor = Math.pow(10, precision);

            let newVal = isPlus 
                ? (Math.round(currentVal * factor) + Math.round(step * factor)) / factor
                : (Math.round(currentVal * factor) - Math.round(step * factor)) / factor;

            if (input.min !== '' && newVal < Number(input.min)) newVal = Number(input.min);
            if (input.max !== '' && newVal > Number(input.max)) newVal = Number(input.max);

            input.value = newVal;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

}
