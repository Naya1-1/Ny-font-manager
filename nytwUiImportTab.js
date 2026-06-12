import { saveSettingsDebounced } from '../../../../script.js';
import { queueApplyFonts } from './nytwCore.js';
import { settings } from './nytwState.js';
import { notify } from './nytwUtils.js';
import {
    createFontId,
    deleteFontBlob,
    extractFontFamiliesFromCssText,
    formatBytes,
    getFontBlob,
    getFontFamilyDisplayLabel,
    getImportedFontKind,
    inferFamiliesFromGoogleFontsCssUrl,
    inferFontFormatFromFileName,
    normalizeExternalStylesheetUrl,
    normalizeFontFamily,
    parseFontFamilyList,
    putFontBlob,
    toCssFontFamilyValue,
    uniqueFontFamily,
} from './nytwFonts.js';

const FONT_CONFIG_SCHEMA = 'Ny-font-manager.font-config';
const FONT_CONFIG_VERSION = 1;

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

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('字体文件读取失败'));
        reader.readAsDataURL(blob);
    });
}

function dataUrlToBlob(dataUrl, fallbackType = '') {
    const text = String(dataUrl || '');
    const commaIndex = text.indexOf(',');
    if (!text.startsWith('data:') || commaIndex < 0) {
        throw new Error('字体文件数据格式无效');
    }

    const header = text.slice(0, commaIndex);
    const payload = text.slice(commaIndex + 1);
    const mimeMatch = header.match(/^data:([^;,]*)/i);
    const mimeType = mimeMatch?.[1] || fallbackType || '';
    const isBase64 = /;base64/i.test(header);

    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
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

function buildExportFileName() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `Ny-font-manager-font-config-${stamp}.json`;
}

function parseFontConfigPayload(text) {
    let payload;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error('配置文件不是有效的 JSON。');
    }

    if (!payload || typeof payload !== 'object') {
        throw new Error('配置文件格式无效。');
    }

    const importedFonts = Array.isArray(payload.importedFonts)
        ? payload.importedFonts
        : (Array.isArray(payload.fonts) ? payload.fonts : null);
    if (!importedFonts) {
        throw new Error('配置文件中没有找到已导入字体列表。');
    }

    let fontFiles = [];
    if (Array.isArray(payload.fontFiles)) {
        fontFiles = payload.fontFiles;
    } else if (payload.fontBlobs && typeof payload.fontBlobs === 'object') {
        fontFiles = Object.entries(payload.fontBlobs).map(([id, entry]) => ({ id, ...(entry || {}) }));
    }

    return { importedFonts, fontFiles };
}

function normalizeImportedFontRecord(rawFont) {
    if (!rawFont || typeof rawFont !== 'object') return null;

    const id = String(rawFont.id || createFontId()).trim() || createFontId();
    const family = normalizeFontFamily(rawFont.family || rawFont.name || '');
    if (!family) return null;

    if (getImportedFontKind(rawFont) === 'css') {
        const cssUrl = normalizeExternalStylesheetUrl(rawFont.cssUrl || rawFont.url || '');
        if (!cssUrl) return null;
        return {
            id,
            kind: 'css',
            family,
            cssUrl,
        };
    }

    const fileName = String(rawFont.fileName || rawFont.name || `${family}.font`).trim().slice(0, 240);
    const size = Number(rawFont.size);
    return {
        id,
        kind: 'file',
        name: family,
        family,
        fileName,
        size: Number.isFinite(size) && size > 0 ? size : 0,
        format: String(rawFont.format || inferFontFormatFromFileName(fileName) || '').trim().slice(0, 40),
    };
}

function getFamilyMergeKey(font) {
    return `${getImportedFontKind(font)}:${normalizeFontFamily(font?.family).toLowerCase()}`;
}

function mergeImportedFontRecords(importedFonts) {
    const next = Array.isArray(settings.importedFonts) ? [...settings.importedFonts] : [];
    let added = 0;
    let updated = 0;

    for (const font of importedFonts) {
        const id = String(font?.id || '').trim();
        const familyKey = getFamilyMergeKey(font);
        let index = id ? next.findIndex((item) => String(item?.id || '') === id) : -1;
        if (index < 0 && familyKey !== `${getImportedFontKind(font)}:`) {
            index = next.findIndex((item) => getFamilyMergeKey(item) === familyKey);
        }

        if (index >= 0) {
            next[index] = { ...next[index], ...font };
            updated++;
        } else {
            next.push(font);
            added++;
        }
    }

    settings.importedFonts = next;
    return { added, updated };
}

async function exportFontConfig() {
    const importedFonts = Array.isArray(settings.importedFonts) ? settings.importedFonts : [];
    const fontFiles = [];
    const missingFileFonts = [];

    for (const font of importedFonts) {
        if (getImportedFontKind(font) !== 'file' || !font?.id) continue;
        const blob = await getFontBlob(font.id);
        if (!blob) {
            missingFileFonts.push(font.family || font.fileName || font.id);
            continue;
        }

        fontFiles.push({
            id: font.id,
            fileName: font.fileName || blob.name || '',
            type: blob.type || '',
            size: blob.size || font.size || 0,
            dataUrl: await blobToDataUrl(blob),
        });
    }

    downloadJsonFile(buildExportFileName(), {
        schema: FONT_CONFIG_SCHEMA,
        version: FONT_CONFIG_VERSION,
        exportedAt: new Date().toISOString(),
        importedFonts: cloneJsonValue(importedFonts),
        fontFiles,
    });

    const fileCount = fontFiles.length;
    const cssCount = importedFonts.filter((font) => getImportedFontKind(font) === 'css').length;
    if (missingFileFonts.length) {
        notify('warning', `已导出字体配置，但有 ${missingFileFonts.length} 个本地字体文件未找到，需重新导入。`);
    } else {
        notify('success', `已导出字体配置（${cssCount} 个 Web 字体，${fileCount} 个本地字体）。`);
    }
}

async function importFontConfigFromFile(file) {
    const text = await readFileAsText(file);
    const payload = parseFontConfigPayload(text);
    const fileMap = new Map(
        payload.fontFiles
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => [String(entry.id || '').trim(), entry]),
    );

    const imported = [];
    let skipped = 0;
    let restoredFiles = 0;

    for (const rawFont of payload.importedFonts) {
        const font = normalizeImportedFontRecord(rawFont);
        if (!font) {
            skipped++;
            continue;
        }

        if (getImportedFontKind(font) === 'file') {
            const fileEntry = fileMap.get(font.id);
            if (fileEntry?.dataUrl) {
                try {
                    const blob = dataUrlToBlob(fileEntry.dataUrl, fileEntry.type || '');
                    await putFontBlob(font.id, blob);
                    if (!font.size && blob.size) font.size = blob.size;
                    restoredFiles++;
                } catch (error) {
                    console.warn('[NyTW] Failed to restore font blob', font.fileName || font.id, error);
                    skipped++;
                    continue;
                }
            } else {
                let existingBlob = null;
                try {
                    existingBlob = await getFontBlob(font.id);
                } catch { /* no-op */ }

                if (!existingBlob) {
                    skipped++;
                    continue;
                }
            }
        }

        imported.push(font);
    }

    if (!imported.length) {
        throw new Error('没有可导入的字体配置。');
    }

    const result = mergeImportedFontRecords(imported);
    saveSettingsDebounced();
    renderImportedFontsList();
    setImportedFontsPanelOpen(true);
    queueApplyFonts();

    const details = [`新增 ${result.added} 个`, `更新 ${result.updated} 个`];
    if (restoredFiles) details.push(`恢复 ${restoredFiles} 个本地文件`);
    if (skipped) details.push(`跳过 ${skipped} 个无效/缺少文件项`);
    notify(skipped ? 'warning' : 'success', `字体配置导入完成：${details.join('，')}。`);
}

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

    }

    const fileBtn = document.getElementById('nytw_font_file_btn');
    const fileInput = document.getElementById('nytw_font_file');
    const fileDisplay = document.getElementById('nytw_font_file_display');
    const cssUrlInput = document.getElementById('nytw_font_css_url');
    const importBtn = document.getElementById('nytw_import_font');
    const exportConfigBtn = document.getElementById('nytw_export_font_config');
    const importConfigBtn = document.getElementById('nytw_import_font_config');
    const configFileInput = document.getElementById('nytw_font_config_file');

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

    exportConfigBtn?.addEventListener('click', async () => {
        if (exportConfigBtn instanceof HTMLButtonElement) exportConfigBtn.disabled = true;
        try {
            await exportFontConfig();
        } catch (error) {
            console.error('[NyTW] Failed to export font config', error);
            notify('error', `字体配置导出失败：${error?.message || error}`);
        } finally {
            if (exportConfigBtn instanceof HTMLButtonElement) exportConfigBtn.disabled = false;
        }
    });

    importConfigBtn?.addEventListener('click', () => {
        if (configFileInput instanceof HTMLInputElement) {
            configFileInput.value = '';
            configFileInput.click();
        }
    });

    configFileInput?.addEventListener('change', async () => {
        const file = configFileInput instanceof HTMLInputElement ? configFileInput.files?.[0] : null;
        if (!file) return;

        if (importConfigBtn instanceof HTMLButtonElement) importConfigBtn.disabled = true;
        try {
            await importFontConfigFromFile(file);
        } catch (error) {
            console.error('[NyTW] Failed to import font config', error);
            notify('error', `字体配置导入失败：${error?.message || error}`);
        } finally {
            if (configFileInput instanceof HTMLInputElement) configFileInput.value = '';
            if (importConfigBtn instanceof HTMLButtonElement) importConfigBtn.disabled = false;
        }
    });

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
                const matchesDeletedFamily = (value) => {
                    const families = parseFontFamilyList(value);
                    return families.length === 1 && families[0] === deletedFamily;
                };

                if (matchesDeletedFamily(settings.globalFont)) settings.globalFont = '';
                if (matchesDeletedFamily(settings.bodyFont)) settings.bodyFont = '';
                if (matchesDeletedFamily(settings.dialogueFont)) settings.dialogueFont = '';
                if (matchesDeletedFamily(settings.customFont)) settings.customFont = '';

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

