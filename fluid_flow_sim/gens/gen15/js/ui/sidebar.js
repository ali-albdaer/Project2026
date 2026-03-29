// ────────────────────────────────────────────
// sidebar.js — Left sidebar with collapsible panels
// ────────────────────────────────────────────

import { bus, EVT } from '../events.js';

export class Sidebar {
    constructor(containerEl) {
        this.container = containerEl;
        this.panels = [];
        this.collapsed = false;
    }

    /**
     * Add a panel to the sidebar.
     * @param {string} id — unique panel id
     * @param {string} title — panel header text
     * @param {string} shortcut — keyboard shortcut label
     * @param {HTMLElement} contentEl — panel content DOM node
     * @returns {Panel}
     */
    addPanel(id, title, shortcut, contentEl) {
        const panel = new Panel(id, title, shortcut, contentEl);
        this.panels.push(panel);
        this.container.appendChild(panel.el);
        return panel;
    }

    /** Toggle entire sidebar visibility. */
    toggle() {
        this.collapsed = !this.collapsed;
        document.getElementById('sidebar').classList.toggle('collapsed', this.collapsed);
    }

    /** Show/hide sidebar. */
    setVisible(v) {
        this.collapsed = !v;
        document.getElementById('sidebar').classList.toggle('collapsed', this.collapsed);
    }

    /** Toggle a specific panel by index (0-based). */
    togglePanel(index) {
        if (index >= 0 && index < this.panels.length) {
            this.panels[index].toggle();
        }
    }

    /** Get panel by id. */
    getPanel(id) {
        return this.panels.find(p => p.id === id);
    }
}

class Panel {
    constructor(id, title, shortcut, contentEl) {
        this.id = id;
        this.expanded = true;

        this.el = document.createElement('div');
        this.el.className = 'panel';
        this.el.id = `panel-${id}`;

        // Header
        this.header = document.createElement('div');
        this.header.className = 'panel-header';
        this.header.innerHTML = `
            <span class="panel-title">${title}</span>
            <span class="panel-shortcut">${shortcut}</span>
            <span class="panel-chevron">&#9660;</span>
        `;
        this.header.addEventListener('click', () => this.toggle());

        // Content wrapper
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.className = 'panel-content';
        this.contentWrapper.appendChild(contentEl);

        this.el.appendChild(this.header);
        this.el.appendChild(this.contentWrapper);
    }

    toggle() {
        this.expanded = !this.expanded;
        this.el.classList.toggle('collapsed', !this.expanded);
    }

    setExpanded(v) {
        this.expanded = v;
        this.el.classList.toggle('collapsed', !this.expanded);
    }
}
