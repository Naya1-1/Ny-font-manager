import { saveSettingsDebounced } from '../../../../script.js';
import { applyTypographyVariables, queueApplyFonts, scheduleScan } from './nytwCore.js';
import { debounce } from './nytwUtils.js';
import { clampOptionalFontSize, clampOptionalLetterSpacing, clampStreamAnimSpeed, normalizeStreamAnimEffect, normalizeStreamRenderMode, settings } from './nytwState.js';

export function initDisplaySettingsTab() {
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

    const typoRowCustomEl = document.getElementById('nytw_typo_row_custom');
    const typoRowLocaleEl = document.getElementById('nytw_typo_row_locale');
    const customWrapEnabledEl = document.getElementById('nytw_custom_font_wrap_enabled');
    const localeFontEnabledEl = document.getElementById('nytw_locale_font_enabled');

    const bodyFontSizeEl = document.getElementById('nytw_body_font_size');
    const bodyLetterSpacingEl = document.getElementById('nytw_body_letter_spacing');
    const dialogueFontSizeEl = document.getElementById('nytw_dialogue_font_size');
    const dialogueLetterSpacingEl = document.getElementById('nytw_dialogue_letter_spacing');
    const customFontSizeEl = document.getElementById('nytw_custom_font_size');
    const customLetterSpacingEl = document.getElementById('nytw_custom_letter_spacing');
    const localeFontSizeEl = document.getElementById('nytw_locale_font_size');
    const localeLetterSpacingEl = document.getElementById('nytw_locale_letter_spacing');

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

    const readTypographyFromEl = (el) => {
        if (!(el instanceof HTMLElement)) return { fontSizePx: null, letterSpacingEm: null };
        const style = getComputedStyle(el);
        const fontSizePx = pxToNumber(style.fontSize);
        const letterSpacingEm = toLetterSpacingEm(style.letterSpacing, fontSizePx);
        return { fontSizePx, letterSpacingEm };
    };

    const setPlaceholder = (inputEl, text, fallback = '默认') => {
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

        setPlaceholder(bodyFontSizeEl, body.fontSizePx === null ? '' : formatNumber(body.fontSizePx, 2));
        setPlaceholder(bodyLetterSpacingEl, body.letterSpacingEm === null ? '' : formatNumber(body.letterSpacingEm, 2));
        setPlaceholder(dialogueFontSizeEl, dialogue.fontSizePx === null ? '' : formatNumber(dialogue.fontSizePx, 2));
        setPlaceholder(dialogueLetterSpacingEl, dialogue.letterSpacingEm === null ? '' : formatNumber(dialogue.letterSpacingEm, 2));
        setPlaceholder(customFontSizeEl, custom.fontSizePx === null ? '' : formatNumber(custom.fontSizePx, 2));
        setPlaceholder(customLetterSpacingEl, custom.letterSpacingEm === null ? '' : formatNumber(custom.letterSpacingEm, 2));
        setPlaceholder(localeFontSizeEl, locale.fontSizePx === null ? '' : formatNumber(locale.fontSizePx, 2));
        setPlaceholder(localeLetterSpacingEl, locale.letterSpacingEm === null ? '' : formatNumber(locale.letterSpacingEm, 2));
    };

    const debouncedSaveAndApplyTypography = debounce(() => {
        saveSettingsDebounced();
        applyTypographyVariables();
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

    const syncStreamAnimUi = () => {
        const mode = normalizeStreamRenderMode(settings.streamRenderMode);
        const isBuffer = mode === 'buffer';

        if (streamAnimSectionEl) {
            streamAnimSectionEl.classList.toggle('is-disabled', !isBuffer);
        }

        const effect = normalizeStreamAnimEffect(settings.streamAnimEffect);
        if (streamAnimEffectEl && (streamAnimEffectEl instanceof HTMLSelectElement || streamAnimEffectEl instanceof HTMLInputElement)) {
            streamAnimEffectEl.value = effect;
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
                    span.textContent = effect === 'typewriter' ? 'A_' : 'Aa';
                    previewEl.appendChild(span);
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
            streamAnimCursorEl.checked = Boolean(settings.streamAnimCursor);
            
            // Sync custom cursor button UI
            const wrapper = document.querySelector('.nytw-cursor-toggle-wrapper');
            if (wrapper) {
                const statusText = wrapper.querySelector('.cursor-status');
                if (statusText) statusText.textContent = streamAnimCursorEl.checked ? 'ON' : 'OFF';
            }
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
            // Immediate update of status text
            const wrapper = document.querySelector('.nytw-cursor-toggle-wrapper');
            if (wrapper) {
                const statusText = wrapper.querySelector('.cursor-status');
                if (statusText) statusText.textContent = streamAnimCursorEl.checked ? 'ON' : 'OFF';
            }
            saveSettingsDebounced();
            scheduleScan({ full: false });
        });
    }

    // Typography controls
    bindOptionalNumberInput(
        bodyFontSizeEl,
        () => settings.bodyFontSize,
        (v) => { settings.bodyFontSize = v; },
        clampOptionalFontSize,
    );
    bindOptionalNumberInput(
        bodyLetterSpacingEl,
        () => settings.bodyLetterSpacing,
        (v) => { settings.bodyLetterSpacing = v; },
        clampOptionalLetterSpacing,
    );
    bindOptionalNumberInput(
        dialogueFontSizeEl,
        () => settings.dialogueFontSize,
        (v) => { settings.dialogueFontSize = v; },
        clampOptionalFontSize,
    );
    bindOptionalNumberInput(
        dialogueLetterSpacingEl,
        () => settings.dialogueLetterSpacing,
        (v) => { settings.dialogueLetterSpacing = v; },
        clampOptionalLetterSpacing,
    );
    bindOptionalNumberInput(
        customFontSizeEl,
        () => settings.customFontSize,
        (v) => { settings.customFontSize = v; },
        clampOptionalFontSize,
    );
    bindOptionalNumberInput(
        customLetterSpacingEl,
        () => settings.customLetterSpacing,
        (v) => { settings.customLetterSpacing = v; },
        clampOptionalLetterSpacing,
    );
    bindOptionalNumberInput(
        localeFontSizeEl,
        () => settings.localeFontSize,
        (v) => { settings.localeFontSize = v; },
        clampOptionalFontSize,
    );
    bindOptionalNumberInput(
        localeLetterSpacingEl,
        () => settings.localeLetterSpacing,
        (v) => { settings.localeLetterSpacing = v; },
        clampOptionalLetterSpacing,
    );

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
                    if (input.id.includes('spacing')) currentVal = 0;
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

    // Collapsible cards logic
    document.querySelectorAll('.nytw-card-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const card = toggle.closest('.nytw-display-setting-card');
            if (card) {
                card.classList.toggle('is-collapsed');
            }
        });
    });

    // Default collapse Typography card for cleaner look
    const typoCard = document.getElementById('nytw_typography_card');
    if (typoCard) typoCard.classList.add('is-collapsed');
}
