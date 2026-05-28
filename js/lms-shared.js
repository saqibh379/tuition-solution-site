(function (window) {
    'use strict';

    function getApi() {
        if (!window.TuitionSolutionApi) {
            throw new Error('API client unavailable.');
        }

        return window.TuitionSolutionApi;
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function formatDate(value, withTime) {
        if (!value) {
            return 'Not scheduled';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat('en-PK', withTime ? {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        } : {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    function formatDateInput(value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value).slice(0, 10);
        }

        return date.toISOString().slice(0, 10);
    }

    function renderNotice(element, message, tone) {
        if (!element) {
            return;
        }

        if (!message) {
            element.textContent = '';
            element.dataset.visible = 'false';
            element.dataset.tone = tone || 'info';
            return;
        }

        element.textContent = message;
        element.dataset.visible = 'true';
        element.dataset.tone = tone || 'info';
    }

    function setBusy(button, busy, idleText, busyText) {
        if (!button) {
            return;
        }

        button.disabled = busy;
        button.innerHTML = busy
            ? '<i class="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>' + (busyText || 'Please wait...')
            : idleText;
    }

    function createViewNavigator(options) {
        const navRoot = options && options.navRoot;
        const linkSelector = options && options.linkSelector ? options.linkSelector : '[data-view-target]';
        const panelSelector = options && options.panelSelector ? options.panelSelector : '.lms-view-panel';
        const activeClass = options && options.activeClass ? options.activeClass : 'is-active';
        const onChange = options && typeof options.onChange === 'function' ? options.onChange : null;
        let activeView = options && options.defaultView ? options.defaultView : '';

        function getPanels() {
            const panelRoot = options && options.panelRoot ? options.panelRoot : document;
            return Array.from(panelRoot.querySelectorAll(panelSelector));
        }

        function getLinks() {
            if (!navRoot) {
                return [];
            }

            return Array.from(navRoot.querySelectorAll(linkSelector));
        }

        function resolveView(viewId) {
            const panels = getPanels();
            if (!panels.length) {
                return '';
            }

            const requested = viewId || activeView;
            if (requested && panels.some((panel) => panel.id === requested)) {
                return requested;
            }

            return panels[0].id || '';
        }

        function sync(viewId) {
            const nextView = resolveView(viewId);
            const panels = getPanels();
            const links = getLinks();

            activeView = nextView;

            panels.forEach((panel) => {
                panel.hidden = Boolean(nextView) && panel.id !== nextView;
            });

            links.forEach((link) => {
                const target = link.getAttribute('data-view-target');
                const isActive = target === nextView;
                link.classList.toggle(activeClass, isActive);
                if ('ariaCurrent' in link) {
                    link.setAttribute('aria-current', isActive ? 'page' : 'false');
                }
            });

            if (nextView && onChange) {
                onChange(nextView);
            }

            return nextView;
        }

        if (navRoot) {
            navRoot.addEventListener('click', (event) => {
                const link = event.target.closest(linkSelector);
                if (!link || !navRoot.contains(link)) {
                    return;
                }

                event.preventDefault();
                sync(link.getAttribute('data-view-target'));
            });
        }

        return {
            getActiveView: function () {
                return activeView;
            },
            setActiveView: sync,
            sync: sync
        };
    }

    async function ensureRole(role, redirectUrl) {
        const api = getApi();
        const session = await api.lmsSession();

        if (!session || !session.authenticated || !session.user || (role && session.user.role !== role)) {
            window.location.href = redirectUrl;
            return null;
        }

        return session.user;
    }

    async function logout(redirectUrl) {
        try {
            await getApi().lmsLogout();
        } catch {
            // Best effort logout.
        }

        window.location.href = redirectUrl || 'lms.html';
    }

    window.TuitionSolutionLms = {
        getApi,
        escapeHtml,
        formatDate,
        formatDateInput,
        renderNotice,
        setBusy,
        createViewNavigator,
        ensureRole,
        logout
    };
})(window);