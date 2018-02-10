'use babel';

import panel from './panel';

let currentIndex = -1;
let errorList = [];

export default {
    quickfixReset() {
        currentIndex = -1;
        errorList = [];
    },

    quickfixPush(view, filename, line, column, position, style) {
        errorList.push({
            view,
            filename,
            line,
            column,
            position,
            style,
        });
    },

    quickfixActive(index) {
        // unselect current index
        if (currentIndex >= 0 && currentIndex < errorList.length) {
            const error = errorList[currentIndex];
            if (error.view) {
                error.view.removeClass('selected');
            }
            currentIndex = -1;
        }

        // select new index
        if (index >= 0 && index < errorList.length) {
            const error = errorList[index];
            panel.scrollPosition(error.position);
            if (error.view) {
                error.view.addClass('selected');
                error.view.goToLine();
            }
            currentIndex = index;
        }
    },

    quickfixFirst() {
        this.quickfixActive(0);
    },

    quickfixLast() {
        this.quickfixActive(errorList.length - 1);
    },

    quickfixNext() {
        if (currentIndex < errorList.length - 1) {
            this.quickfixActive(currentIndex + 1);
        }
    },

    quickfixPrev() {
        if (currentIndex > 0) {
            this.quickfixActive(currentIndex - 1);
        }
    },
};
