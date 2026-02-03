export function initHelpTab(root) {
    if (!(root instanceof HTMLElement)) return;
    const helpToggles = root.querySelectorAll('.nytw-help-toggle');
    helpToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const content = toggle.nextElementSibling;
            if (content && content.classList.contains('nytw-collapsible')) {
                const isOpen = content.classList.contains('is-open');
                content.classList.toggle('is-open', !isOpen);
                content.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
                toggle.classList.toggle('is-open', !isOpen);
            }
        });
    });
}

