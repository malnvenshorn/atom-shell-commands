'use babel';

import { MessagePanelView, PlainMessageView, LineMessageView } from 'atom-message-panel';

let panel = null;

export default {
    init() {
        if (!panel) {
            panel = new MessagePanelView({
                title: 'Atom Shell Commands',
                rawTitle: false,
                autoScroll: true,
                maxHeight: '130px',
            });
        }
    },

    remove() {
        if (panel) {
            panel.remove();
            panel = null;
        }
    },

    toggle() {
        if (panel && panel.panel && panel.panel.isVisible()) {
            this.messageHide();
        } else {
            this.messageShow();
        }
    },

    messageShow() {
        if (panel) {
            panel.attach();
        }
    },

    messageHide() {
        if (panel) {
            panel.close();
        }
    },

    messageClear() {
        if (panel) {
            panel.clear();
        }
    },

    messagePlain(message, style) {
        if (panel) {
            const text = new PlainMessageView({
                raw: false,
                message,
                className: style,
            });
            const position = panel.body[0].scrollHeight;
            panel.add(text);
            text.atompos = position - text.outerHeight();
            return text;
        }
        return null;
    },

    messageLine(file, line, column, message, style, preview) {
        if (panel) {
            const text = new LineMessageView({
                file,
                line,
                column,
                message,
                className: style,
                preview,
            });
            text.position.text(message);
            text.contents.text('');
            text.position.addClass(style);
            text.position.removeClass('text-subtle');
            // text.position.removeClass('inline-block');
            const position = panel.body[0].scrollHeight;
            panel.add(text);
            text.atompos = position - text.outerHeight();
            return text;
        }
        return null;
    },

    updateScroll() {
        if (panel) {
            panel.updateScroll();
        }
    },

    updateTitle(title) {
        if (!panel) return;
        if (!title) {
            panel.setTitle('Atom Shell Commands');
        } else {
            panel.setTitle(`Atom Shell Commands: ${title}`);
        }
    },

    scrollPosition(position) {
        if (panel) {
            panel.body.scrollTop(position);
        }
    },
};
