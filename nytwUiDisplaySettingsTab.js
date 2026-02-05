import { saveSettingsDebounced } from '../../../../script.js';
import { queueApplyFonts, scheduleScan } from './nytwCore.js';
import { clampStreamAnimSpeed, normalizeStreamAnimEffect, normalizeStreamRenderMode, settings } from './nytwState.js';

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
}
