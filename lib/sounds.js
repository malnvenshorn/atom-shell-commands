'use babel';

import path from 'path';

const bank = {};

export default {
    play(filename) {
        const filepath = path.resolve(filename);
        let audio = null;
        if (filepath in bank) {
            audio = bank[filepath];
        } else {
            audio = new Audio(filepath);
            bank[filepath] = audio;
        }
        audio.play();
        return true;
    },
};
