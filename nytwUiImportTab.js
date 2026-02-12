import { saveSettingsDebounced } from '../../../../script.js';
import { queueApplyFonts } from './nytwCore.js';
import { settings } from './nytwState.js';
import { notify } from './nytwUtils.js';
import {
    createFontId,
    deleteFontBlob,
    extractFontFamiliesFromCssText,
    formatBytes,
    getFontFamilyDisplayLabel,
    getImportedFontKind,
    inferFamiliesFromGoogleFontsCssUrl,
    inferFontFormatFromFileName,
    normalizeExternalStylesheetUrl,
    normalizeFontFamily,
    putFontBlob,
    toCssFontFamilyValue,
    uniqueFontFamily,
} from './nytwFonts.js';

function setImportedFontsPanelOpen(open) {
    const importedFontsToggle = document.getElementById('nytw_imported_fonts_toggle');
    const importedFontsPanel = document.getElementById('nytw_imported_fonts_panel');

    if (importedFontsPanel) {
        importedFontsPanel.classList.toggle('is-open', open);
        importedFontsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    importedFontsToggle?.classList.toggle('is-open', open);
}

function renderImportedFontsList() {
    const container = document.getElementById('nytw_imported_fonts');
    if (!container) return;

    container.innerHTML = '';

    if (!settings.importedFonts.length) {
        const empty = document.createElement('div');
        empty.className = 'nytw-help';
        empty.textContent = '暂无已导入字体。';
        container.appendChild(empty);
        return;
    }

    for (const font of settings.importedFonts) {
        const row = document.createElement('div');
        row.className = 'nytw-font-row';
        row.dataset.fontId = font.id;

        // Header: Meta + Delete
        const header = document.createElement('div');
        header.className = 'nytw-font-header';

        const meta = document.createElement('div');
        meta.className = 'nytw-font-meta';

        const name = document.createElement('div');
        name.className = 'nytw-font-name';
        const family = String(font.family || font.name || '').trim();
        name.textContent = family ? (getFontFamilyDisplayLabel(family) || family) : '未命名';

        const sub = document.createElement('div');
        sub.className = 'nytw-font-sub';
        const pieces = [];
        if (getImportedFontKind(font) === 'css') {
            if (font.cssUrl) pieces.push(font.cssUrl);
            pieces.push('css');
        } else {
            if (font.fileName) pieces.push(font.fileName);
            if (font.format) pieces.push(font.format);
            if (font.size) pieces.push(formatBytes(font.size));
        }
        sub.textContent = pieces.join(' · ');

        meta.appendChild(name);
        meta.appendChild(sub);

        const del = document.createElement('button');
        del.className = 'menu_button nytw-font-delete';
        del.textContent = '删除';

        header.appendChild(meta);
        header.appendChild(del);

        // Actions: Use buttons
        const actions = document.createElement('div');
        actions.className = 'nytw-font-actions';

        const useGlobal = document.createElement('button');
        useGlobal.className = 'menu_button nytw-font-use-global';
        useGlobal.textContent = '设为全局';

        const useBody = document.createElement('button');
        useBody.className = 'menu_button nytw-font-use-body';
        useBody.textContent = '设为正文';

        const useDialogue = document.createElement('button');
        useDialogue.className = 'menu_button nytw-font-use-dialogue';
        useDialogue.textContent = '设为对话';

        const useCustom = document.createElement('button');
        useCustom.className = 'menu_button nytw-font-use-custom';
        useCustom.textContent = '设为自定义';

        actions.appendChild(useGlobal);
        actions.appendChild(useBody);
        actions.appendChild(useDialogue);
        actions.appendChild(useCustom);

        row.appendChild(header);
        row.appendChild(actions);
        container.appendChild(row);
    }
}

export function initImportTab() {
    const importedFontsToggle = document.getElementById('nytw_imported_fonts_toggle');
    const importedFontsPanel = document.getElementById('nytw_imported_fonts_panel');
    if (importedFontsToggle) {
        importedFontsToggle.addEventListener('click', () => {
            const isOpen = importedFontsPanel?.classList.contains('is-open');
            setImportedFontsPanelOpen(!isOpen);
        });

        // Default to open if there are fonts
        if (settings.importedFonts && settings.importedFonts.length > 0) {
            setImportedFontsPanelOpen(true);
        }
    }

    const fileBtn = document.getElementById('nytw_font_file_btn');
    const fileInput = document.getElementById('nytw_font_file');
    const fileDisplay = document.getElementById('nytw_font_file_display');
    const cssUrlInput = document.getElementById('nytw_font_css_url');
    const importBtn = document.getElementById('nytw_import_font');

    const updateImportBtnState = () => {
        const hasFile = fileInput?.files?.length > 0;
        const hasUrl = Boolean(cssUrlInput?.value?.trim());
        if (hasFile || hasUrl) {
            importBtn?.classList.add('nytw-import-ready');
        } else {
            importBtn?.classList.remove('nytw-import-ready');
        }
    };

    cssUrlInput?.addEventListener('input', updateImportBtnState);

    fileBtn?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file) {
            if (fileDisplay instanceof HTMLInputElement) fileDisplay.value = file.name;
        } else {
            if (fileDisplay instanceof HTMLInputElement) fileDisplay.value = '';
        }
        updateImportBtnState();
    });

    importBtn?.addEventListener('click', async () => {
        const fileEl = document.getElementById('nytw_font_file');
        const cssUrlEl = document.getElementById('nytw_font_css_url');

        const file = fileEl instanceof HTMLInputElement ? fileEl.files?.[0] : null;
        const rawCssUrl = cssUrlEl instanceof HTMLInputElement ? cssUrlEl.value : '';
        const cssUrl = normalizeExternalStylesheetUrl(rawCssUrl);

        if (!file && rawCssUrl && !cssUrl) {
            notify('warning', 'CSS 链接无效。');
            return;
        }

        if (!file && !cssUrl) {
            notify('warning', '请填写 CSS 链接。');
            return;
        }

        if (file) {
            const fallbackName = file.name.replace(/\.[^.]+$/, '');
            const family = uniqueFontFamily(fallbackName);
            const format = inferFontFormatFromFileName(file.name);
            const id = createFontId();

            try {
                await putFontBlob(id, file);
            } catch (error) {
                console.error('[NyTW] Failed to store font', error);
                notify('error', '字体导入失败（无法写入浏览器存储）。');
                return;
            }

            settings.importedFonts.push({
                id,
                kind: 'file',
                name: family,
                family,
                fileName: file.name,
                size: file.size,
                format,
            });

            saveSettingsDebounced();
            renderImportedFontsList();
            setImportedFontsPanelOpen(true);
            queueApplyFonts();

            if (fileEl instanceof HTMLInputElement) fileEl.value = '';
            const fileDisplayEl = document.getElementById('nytw_font_file_display');
            if (fileDisplayEl instanceof HTMLInputElement) fileDisplayEl.value = '';
            if (cssUrlEl instanceof HTMLInputElement) cssUrlEl.value = '';
            updateImportBtnState();
            notify('success', `已导入字体：${getFontFamilyDisplayLabel(family) || family}`);
            return;
        }

        let families = inferFamiliesFromGoogleFontsCssUrl(cssUrl);

        if (!families.length) {
            try {
                const response = await fetch(cssUrl, { cache: 'force-cache' });
                if (response.ok) {
                    const cssText = await response.text();
                    families = extractFontFamiliesFromCssText(cssText);
                }
            } catch (error) {
                console.warn('[NyTW] Failed to fetch/parse CSS font URL', error);
            }
        }

        families = Array.from(new Set(families.map(normalizeFontFamily).filter(Boolean))).slice(0, 20);
        if (!families.length) {
            notify('warning', '无法从 CSS 链接识别字体名称，暂不支持导入。');
            return;
        }

        const existingFamilies = new Set(settings.importedFonts.map(f => String(f?.family || '').trim()));
        const added = [];
        for (const family of families) {
            if (!family || existingFamilies.has(family)) continue;
            settings.importedFonts.push({
                id: createFontId(),
                kind: 'css',
                family,
                cssUrl,
            });
            added.push(family);
        }

        if (!added.length) {
            notify('warning', '没有导入新字体（已存在）。');
            return;
        }

        saveSettingsDebounced();
        renderImportedFontsList();
        setImportedFontsPanelOpen(true);
        queueApplyFonts();

        if (cssUrlEl instanceof HTMLInputElement) cssUrlEl.value = '';
        updateImportBtnState();
        notify('success', `已导入 CSS 字体：${added.map(f => getFontFamilyDisplayLabel(f) || f).join('、')}`);
    });

    const importedContainer = document.getElementById('nytw_imported_fonts');
    importedContainer?.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest('.nytw-font-row');
        if (!row) return;

        const fontId = row.getAttribute('data-font-id') || '';
        const font = settings.importedFonts.find(f => f.id === fontId);
        if (!font) return;

        if (target.classList.contains('nytw-font-use-global')) {
            const family = String(font.family || '').trim();
            settings.globalFont = getFontFamilyDisplayLabel(family) || family;
            const el = document.getElementById('nytw_global_font');
            if (el instanceof HTMLInputElement) {
                el.value = settings.globalFont;
                el.style.fontFamily = toCssFontFamilyValue(el.value);
            }
            saveSettingsDebounced();
            queueApplyFonts();
            return;
        }

        if (target.classList.contains('nytw-font-use-body')) {
            const family = String(font.family || '').trim();
            settings.bodyFont = getFontFamilyDisplayLabel(family) || family;
            const el = document.getElementById('nytw_body_font');
            if (el instanceof HTMLInputElement) {
                el.value = settings.bodyFont;
                el.style.fontFamily = toCssFontFamilyValue(el.value);
            }
            saveSettingsDebounced();
            queueApplyFonts();
            return;
        }

        if (target.classList.contains('nytw-font-use-dialogue')) {
            const family = String(font.family || '').trim();
            settings.dialogueFont = getFontFamilyDisplayLabel(family) || family;
            const el = document.getElementById('nytw_dialogue_font');
            if (el instanceof HTMLInputElement) {
                el.value = settings.dialogueFont;
                el.style.fontFamily = toCssFontFamilyValue(el.value);
            }
            saveSettingsDebounced();
            queueApplyFonts();
            return;
        }

        if (target.classList.contains('nytw-font-use-custom')) {
            const family = String(font.family || '').trim();
            settings.customFont = getFontFamilyDisplayLabel(family) || family;
            const el = document.getElementById('nytw_custom_font');
            if (el instanceof HTMLInputElement) {
                el.value = settings.customFont;
                el.style.fontFamily = toCssFontFamilyValue(el.value);
            }

            // Let the settings-tab handler manage UI + scan via change event.
            const wrapToggle = document.getElementById('nytw_custom_font_wrap_enabled');
            if (wrapToggle instanceof HTMLInputElement && !wrapToggle.checked) {
                wrapToggle.checked = true;
                wrapToggle.dispatchEvent(new Event('change'));
            }

            saveSettingsDebounced();
            queueApplyFonts();
            return;
        }

        if (target.classList.contains('nytw-font-delete')) {
            settings.importedFonts = settings.importedFonts.filter(f => f.id !== fontId);
            const deletedFamily = String(font.family || '').trim();
            if (deletedFamily) {
                if (toCssFontFamilyValue(settings.globalFont) === deletedFamily) settings.globalFont = '';
                if (toCssFontFamilyValue(settings.bodyFont) === deletedFamily) settings.bodyFont = '';
                if (toCssFontFamilyValue(settings.dialogueFont) === deletedFamily) settings.dialogueFont = '';
                if (toCssFontFamilyValue(settings.customFont) === deletedFamily) settings.customFont = '';

                const globalInput = document.getElementById('nytw_global_font');
                if (globalInput instanceof HTMLInputElement) {
                    globalInput.value = settings.globalFont;
                    globalInput.style.fontFamily = toCssFontFamilyValue(globalInput.value);
                }
                const bodyInput = document.getElementById('nytw_body_font');
                if (bodyInput instanceof HTMLInputElement) {
                    bodyInput.value = settings.bodyFont;
                    bodyInput.style.fontFamily = toCssFontFamilyValue(bodyInput.value);
                }
                const dialogueInput = document.getElementById('nytw_dialogue_font');
                if (dialogueInput instanceof HTMLInputElement) {
                    dialogueInput.value = settings.dialogueFont;
                    dialogueInput.style.fontFamily = toCssFontFamilyValue(dialogueInput.value);
                }
                const customInput = document.getElementById('nytw_custom_font');
                if (customInput instanceof HTMLInputElement) {
                    customInput.value = settings.customFont;
                    customInput.style.fontFamily = toCssFontFamilyValue(customInput.value);
                }
            }

            try {
                if (getImportedFontKind(font) === 'file') {
                    await deleteFontBlob(fontId);
                }
            } catch (error) {
                console.warn('[NyTW] Failed to delete font blob', error);
            }

            saveSettingsDebounced();
            renderImportedFontsList();
            queueApplyFonts();
            notify('success', '已删除字体。');
        }
    });

    renderImportedFontsList();
    updateImportBtnState();
}

