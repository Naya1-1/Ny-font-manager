export function notify(type, message) {
    const text = String(message || '');
    const toastrInstance = globalThis.toastr;
    if (toastrInstance && typeof toastrInstance[type] === 'function') {
        toastrInstance[type](text);
        return;
    }
    const method = type === 'error' ? 'error' : 'log';
    console[method](`[NyTW] ${text}`);
}

export function debounce(fn, delayMs) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delayMs);
    };
}

export async function waitForElement(selector, root = document, timeout = 10000) {
    const existing = root.querySelector(selector);
    if (existing) return existing;

    return new Promise((resolve) => {
        const obs = new MutationObserver(() => {
            const el = root.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        obs.observe(root, { childList: true, subtree: true });
        setTimeout(() => {
            obs.disconnect();
            resolve(root.querySelector(selector));
        }, timeout);
    });
}

