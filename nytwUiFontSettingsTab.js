import { saveSettingsDebounced } from '../../../../script.js';
import { queueApplyFonts, scheduleScan } from './nytwCore.js';
import { importer_scheduleScan } from './nytwChatFontImporter.js';
import { settings } from './nytwState.js';
import { debounce } from './nytwUtils.js';
import { getFontFamilyDisplayLabel, setupFontPicker, setupLocalePicker } from './nytwFonts.js';
import { UNICODE_RANGES } from './nytwLocaleData.js';

function renderLocaleFontsList(rootEl, onUpdate) {
    rootEl.innerHTML = '';

    if (!settings.localeFonts || !settings.localeFonts.length) {
        return;
    }

    settings.localeFonts.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'nytw-locale-row';

        // 1. Language/Range Picker (Styled like Font Picker)
        const rangeWrapper = document.createElement('div');
        rangeWrapper.className = 'nytw-input-wrapper nytw-locale-select-wrapper';

        const rangeInput = document.createElement('input');
        rangeInput.type = 'text';
        rangeInput.className = 'text_pole nytw-input nytw-locale-trigger';
        rangeInput.readOnly = true; // User picks from list
        rangeInput.placeholder = '选择语言...';

        const currentDef = UNICODE_RANGES[item.rangeKey];
        rangeInput.value = currentDef ? currentDef.label : item.rangeKey;
        rangeInput.title = rangeInput.value;

        const rangePopup = document.createElement('div');
        rangePopup.className = 'nytw-font-picker-popup';

        rangeWrapper.appendChild(rangeInput);
        rangeWrapper.appendChild(rangePopup);

        setupLocalePicker(rangeInput, rangePopup, (val) => {
            item.rangeKey = val;
            const newDef = UNICODE_RANGES[val];
            rangeInput.value = newDef ? newDef.label : val;
            rangeInput.title = rangeInput.value;
            onUpdate();
        });

        // 2. Font Picker
        const fontWrapper = document.createElement('div');
        fontWrapper.className = 'nytw-input-wrapper';

        const fontInput = document.createElement('input');
        fontInput.type = 'text';
        fontInput.className = 'text_pole nytw-input';
        fontInput.placeholder = '选择字体...';
        fontInput.value = item.font || '';
        fontInput.autocomplete = 'off';

        const fontPopup = document.createElement('div');
        fontPopup.className = 'nytw-font-picker-popup';

        fontWrapper.appendChild(fontInput);
        fontWrapper.appendChild(fontPopup);

        setupFontPicker(fontInput, fontPopup, (val) => {
            item.font = val;
            onUpdate();
        });

        // 3. Delete Button
        const delBtn = document.createElement('button');
        delBtn.className = 'nytw-locale-delete';
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.title = '删除规则';
        delBtn.addEventListener('click', () => {
            settings.localeFonts.splice(index, 1);
            renderLocaleFontsList(rootEl, onUpdate);
            onUpdate();
        });

        row.appendChild(rangeWrapper);
        row.appendChild(fontWrapper);
        row.appendChild(delBtn);
        rootEl.appendChild(row);
    });
}

export function initFontSettingsTab() {
    const enabledEl = document.getElementById('nytw_fonts_enabled');
    const fontsSettingsPanel = document.getElementById('nytw_main_settings_panel');
    const fontsEnabledRow = document.getElementById('nytw_fonts_enabled_row');
    const fontsEnabledText = document.getElementById('nytw_fonts_enabled_text');
    const root = document.getElementById('nytw_settings_root');
    const displayTabItem = document.getElementById('nytw_tab_item_display')
        || root?.querySelector?.('.nytw-tab-item[data-tab="display"]');
    const settingsTabItem = root?.querySelector?.('.nytw-tab-item[data-tab="settings"]');

    const setMainPanelOpen = (open) => {
        if (fontsSettingsPanel) {
            fontsSettingsPanel.classList.toggle('is-open', open);
            fontsSettingsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        fontsEnabledRow?.classList.toggle('is-open', open);
        if (fontsEnabledText) {
            fontsEnabledText.textContent = open ? '字体覆盖已启用' : '点击启用字体覆盖';
        }
    };

    const setDisplayTabVisible = (visible) => {
        if (!(displayTabItem instanceof HTMLElement)) return;

        const wasCollapsed = displayTabItem.classList.contains('is-collapsed');
        const willBeCollapsed = !visible;

        if (wasCollapsed !== willBeCollapsed && settingsTabItem instanceof HTMLElement) {
            settingsTabItem.classList.remove('nytw-tab-anim');
            void settingsTabItem.offsetWidth;
            settingsTabItem.classList.add('nytw-tab-anim');
            setTimeout(() => {
                if (settingsTabItem.isConnected) settingsTabItem.classList.remove('nytw-tab-anim');
            }, 500);
        }

        displayTabItem.classList.toggle('is-collapsed', !visible);
        displayTabItem.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) {
            displayTabItem.removeAttribute('tabindex');
        } else {
            displayTabItem.setAttribute('tabindex', '-1');
            // If the user is currently on the display tab, return them to font settings.
            if (displayTabItem.classList.contains('active') && settingsTabItem instanceof HTMLElement) {
                settingsTabItem.click();
            }
        }
    };

    if (enabledEl instanceof HTMLInputElement) {
        enabledEl.checked = Boolean(settings.fontsEnabled);
        setMainPanelOpen(enabledEl.checked);
        setDisplayTabVisible(enabledEl.checked);

        const updateState = () => {
            settings.fontsEnabled = enabledEl.checked;
            setMainPanelOpen(enabledEl.checked);
            setDisplayTabVisible(enabledEl.checked);
            saveSettingsDebounced();
            queueApplyFonts();
            scheduleScan();
        };

        enabledEl.addEventListener('change', updateState);

        // Click handler for the header row to toggle checkbox
        if (fontsEnabledRow) {
            fontsEnabledRow.addEventListener('click', (e) => {
                // Avoid double toggling if clicking directly on the checkbox (though it's hidden now)
                if (e.target !== enabledEl) {
                    enabledEl.checked = !enabledEl.checked;
                    updateState();
                }
            });
        }
    }

    const debouncedSaveAndApply = debounce(() => {
        saveSettingsDebounced();
        queueApplyFonts();
        scheduleScan();
    }, 200);

    const debouncedSaveAndScan = debounce(() => {
        saveSettingsDebounced();
        scheduleScan();
    }, 200);

    const bodyEl = document.getElementById('nytw_body_font');
    const bodyPopup = document.getElementById('nytw_body_font_popup');
    if (bodyEl instanceof HTMLInputElement && bodyPopup) {
        bodyEl.value = settings.bodyFont || '';
        setupFontPicker(bodyEl, bodyPopup, (val) => {
            settings.bodyFont = val;
            debouncedSaveAndApply();
        });
    }

    const dialogueEl = document.getElementById('nytw_dialogue_font');
    const dialoguePopup = document.getElementById('nytw_dialogue_font_popup');
    if (dialogueEl instanceof HTMLInputElement && dialoguePopup) {
        dialogueEl.value = settings.dialogueFont || '';
        setupFontPicker(dialogueEl, dialoguePopup, (val) => {
            settings.dialogueFont = val;
            debouncedSaveAndApply();
        });
    }

    const customFontEl = document.getElementById('nytw_custom_font');
    const customFontPopup = document.getElementById('nytw_custom_font_popup');
    if (customFontEl instanceof HTMLInputElement && customFontPopup) {
        customFontEl.value = settings.customFont || '';
        setupFontPicker(customFontEl, customFontPopup, (val) => {
            settings.customFont = val;
            debouncedSaveAndApply();
        });
    }

    const customOpenEl = document.getElementById('nytw_custom_font_open');
    if (customOpenEl instanceof HTMLInputElement) {
        customOpenEl.value = settings.customFontOpen || '';
        customOpenEl.addEventListener('input', () => {
            settings.customFontOpen = customOpenEl.value;
            debouncedSaveAndScan();
        });
    }

    const customCloseEl = document.getElementById('nytw_custom_font_close');
    if (customCloseEl instanceof HTMLInputElement) {
        customCloseEl.value = settings.customFontClose || '';
        customCloseEl.addEventListener('input', () => {
            settings.customFontClose = customCloseEl.value;
            debouncedSaveAndScan();
        });
    }

    const customFontWrapToggle = document.getElementById('nytw_custom_font_wrap_toggle');
    const customFontWrapEnabledEl = document.getElementById('nytw_custom_font_wrap_enabled');
    const customFontWrapPanel = document.getElementById('nytw_custom_font_wrap_panel');

    const setCustomFontWrapPanelOpen = (open) => {
        if (customFontWrapPanel) {
            customFontWrapPanel.classList.toggle('is-open', open);
            customFontWrapPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        customFontWrapToggle?.classList.toggle('is-open', open);
    };

    if (customFontWrapEnabledEl instanceof HTMLInputElement) {
        customFontWrapEnabledEl.checked = Boolean(settings.customFontWrapEnabled);
        setCustomFontWrapPanelOpen(customFontWrapEnabledEl.checked);

        const updateWrapState = () => {
            settings.customFontWrapEnabled = customFontWrapEnabledEl.checked;
            saveSettingsDebounced();
            setCustomFontWrapPanelOpen(customFontWrapEnabledEl.checked);
            scheduleScan();
        };

        customFontWrapEnabledEl.addEventListener('change', updateWrapState);

        if (customFontWrapToggle) {
            customFontWrapToggle.addEventListener('click', (e) => {
                if (e.target !== customFontWrapEnabledEl) {
                    customFontWrapEnabledEl.checked = !customFontWrapEnabledEl.checked;
                    updateWrapState();
                }
            });
        }
    } else {
        setCustomFontWrapPanelOpen(Boolean(settings.customFontWrapEnabled));
    }

    // Locale Fonts Logic
    const localeFontToggle = document.getElementById('nytw_locale_font_toggle');
    const localeFontEnabledEl = document.getElementById('nytw_locale_font_enabled');
    const localeFontPanel = document.getElementById('nytw_locale_font_panel');
    const localeListContainer = document.getElementById('nytw_locale_list');
    const addLocaleBtn = document.getElementById('nytw_add_locale_btn');

    const setLocaleFontPanelOpen = (open) => {
        if (localeFontPanel) {
            localeFontPanel.classList.toggle('is-open', open);
            localeFontPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        localeFontToggle?.classList.toggle('is-open', open);
    };

    if (localeFontEnabledEl instanceof HTMLInputElement) {
        localeFontEnabledEl.checked = Boolean(settings.localeFontEnabled);
        setLocaleFontPanelOpen(localeFontEnabledEl.checked);

        const updateLocaleState = () => {
            settings.localeFontEnabled = localeFontEnabledEl.checked;
            saveSettingsDebounced();
            setLocaleFontPanelOpen(localeFontEnabledEl.checked);
            queueApplyFonts();
            scheduleScan();
        };

        localeFontEnabledEl.addEventListener('change', updateLocaleState);

        if (localeFontToggle) {
            localeFontToggle.addEventListener('click', (e) => {
                if (e.target !== localeFontEnabledEl) {
                    localeFontEnabledEl.checked = !localeFontEnabledEl.checked;
                    updateLocaleState();
                }
            });
        }
    }

    const updateLocaleList = debounce(() => {
        saveSettingsDebounced();
        queueApplyFonts();
        scheduleScan();
    }, 500);

    if (addLocaleBtn && localeListContainer) {
        renderLocaleFontsList(localeListContainer, updateLocaleList);

        addLocaleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent toggling parent
            if (!settings.localeFonts) settings.localeFonts = [];
            settings.localeFonts.push({ rangeKey: 'latin', font: '' });

            // Auto-enable if disabled
            if (!settings.localeFontEnabled && localeFontEnabledEl instanceof HTMLInputElement) {
                localeFontEnabledEl.checked = true;
                // Trigger change event to update UI
                localeFontEnabledEl.dispatchEvent(new Event('change'));
            }

            renderLocaleFontsList(localeListContainer, updateLocaleList);
            updateLocaleList(); // Also trigger scan immediately
        });
    }

    // Chat Font Import Toggle
    const chatFontImportRow = document.getElementById('nytw_chat_font_import_row');
    const chatFontImportEnabledEl = document.getElementById('nytw_chat_font_import_enabled');

    if (chatFontImportEnabledEl instanceof HTMLInputElement) {
        chatFontImportEnabledEl.checked = Boolean(settings.chatFontImportEnabled);

        const updateUiState = () => {
            const isEnabled = chatFontImportEnabledEl.checked;
            const textSpan = document.getElementById('nytw_chat_font_import_text');

            if (textSpan) {
                textSpan.textContent = isEnabled
                    ? '外部聊天字体导入运行中'
                    : '点击开启外部聊天字体导入';
            }
            if (chatFontImportRow) {
                chatFontImportRow.classList.toggle('is-open', isEnabled);
            }
        };

        const updateImportState = () => {
            settings.chatFontImportEnabled = chatFontImportEnabledEl.checked;
            updateUiState();
            saveSettingsDebounced();
            if (settings.chatFontImportEnabled) {
                importer_scheduleScan('ENABLE_TOGGLE');
            }
        };

        // Initialize UI
        updateUiState();

        chatFontImportEnabledEl.addEventListener('change', updateImportState);

        if (chatFontImportRow) {
            chatFontImportRow.addEventListener('click', (e) => {
                // If clicking directly on the hidden input, do nothing (change event will handle it)
                if (e.target === chatFontImportEnabledEl) return;

                // Toggle the checkbox
                chatFontImportEnabledEl.checked = !chatFontImportEnabledEl.checked;
                updateImportState();
            });
        }
    }

    const bodyClear = document.getElementById('nytw_body_font_clear');
    bodyClear?.addEventListener('click', () => {
        settings.bodyFont = '';
        if (bodyEl instanceof HTMLInputElement) {
            bodyEl.value = '';
            bodyEl.style.fontFamily = '';
        }
        saveSettingsDebounced();
        queueApplyFonts();
    });

    const dialogueClear = document.getElementById('nytw_dialogue_font_clear');
    dialogueClear?.addEventListener('click', () => {
        settings.dialogueFont = '';
        if (dialogueEl instanceof HTMLInputElement) {
            dialogueEl.value = '';
            dialogueEl.style.fontFamily = '';
        }
        saveSettingsDebounced();
        queueApplyFonts();
    });

    const customFontClear = document.getElementById('nytw_custom_font_clear');
    customFontClear?.addEventListener('click', () => {
        settings.customFont = '';
        if (customFontEl instanceof HTMLInputElement) {
            customFontEl.value = '';
            customFontEl.style.fontFamily = '';
        }
        saveSettingsDebounced();
        queueApplyFonts();
        scheduleScan();
    });

    const customSymbolsClear = document.getElementById('nytw_custom_font_symbols_clear');
    customSymbolsClear?.addEventListener('click', () => {
        settings.customFontOpen = '';
        settings.customFontClose = '';
        if (customOpenEl instanceof HTMLInputElement) customOpenEl.value = '';
        if (customCloseEl instanceof HTMLInputElement) customCloseEl.value = '';
        saveSettingsDebounced();
        scheduleScan();
    });
}
