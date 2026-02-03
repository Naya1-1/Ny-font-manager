export function initTabs(root) {
    if (!(root instanceof HTMLElement)) return;

    const tabs = root.querySelectorAll('.nytw-tab-item');
    const panes = root.querySelectorAll('.nytw-tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = `nytw_tab_${tab.dataset.tab}`;
            const targetPane = document.getElementById(targetId);
            if (!targetPane) return;

            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            targetPane.classList.add('active');
        });
    });
}

