'use babel';

import path from 'path';
import XRegExp from 'xregexp';
import { spawn } from 'child_process';

import panel from './panel';
import quickfix from './quickfix';
import sounds from './sounds';
import terminal from './terminal';

const childs = {};

// Replace members with env variables.
function replace(input, vars) {
    if (typeof input === 'string') {
        let output = input;
        Object.keys(vars).forEach((key) => {
            output = output.replace(`{${key}}`, vars[key]);
        });
        return output;
    } else if (Array.isArray(input)) {
        return input.map(item => replace(item, vars));
    } else if (typeof input === 'object') {
        const output = {};
        Object.keys(input).forEach((key) => {
            output[key] = replace(input[key], vars);
        });
        return output;
    }

    return input;
}

function cleanEnv() {
    return {
        FilePath: '',
        FileName: '',
        FileDir: '',
        FileExt: '',
        FileNameNoExt: '',
        ProjectDir: '',
        ProjectRel: '',
        CurRow: 0,
        CurCol: 0,
        CurSelected: '',
        CurLineText: '',
        CurWord: '',
    };
}

// Generate Environment variables
function getEnv() {
    const env = cleanEnv();
    const editor = atom.workspace.getActiveTextEditor();
    const filepath = (editor && editor.getPath) ? editor.getPath() : null;

    if (filepath) {
        env.FilePath = filepath;
        env.FileName = path.basename(filepath);
        env.FileDir = path.dirname(filepath);

        const info = path.parse(filepath);
        env.FileExt = info.ext || '';
        env.FileNameNoExt = info.name;

        const paths = atom.project.relativizePath(filepath);
        env.ProjectDir = paths[0] || '';
        env.ProjectRel = paths[1] || '';

        env.CurSelected = editor.getSelectedText() || '';

        const position = editor.getCursorBufferPosition() || null;
        env.CurCol = (position) ? position.column : 0;
        env.CurRow = (position) ? position.row : 0;

        if (position) {
            const range = [[env.CurRow, 0], [env.CurRow, 1E10]];
            env.CurLineText = editor.getTextInBufferRange(range) || '';
            env.CurWord = editor.getWordUnderCursor();
        }
    }

    return env;
}

export default {
    childStop() {
        const pids = Object.keys(childs);
        pids.forEach((pid) => {
            const child = childs[pid];
            child.kill();
        });
    },

    childKill() {
        const pids = Object.keys(childs);
        pids.forEach((pid) => {
            const child = childs[pid];
            child.kill('SIGKILL');
            delete childs[pid];
        });
    },

    execute(cmd) {
        const env = getEnv();

        const command = replace(cmd.command || '', env);
        const args = replace(cmd.arguments || [], env);
        const options = replace(cmd.options || {}, env);
        const matchs = Array.prototype.map.call(cmd.matchs || [], item => XRegExp.XRegExp(item));

        let mode = options.mode || '';

        mode = (mode === '' && options.silent) ? 'silent' : mode;
        mode = (mode === 'window' || mode === 'open') ? 'terminal' : mode;
        mode = (mode !== 'terminal' && mode !== 'silent') ? '' : mode;

        const cwd = options.cwd || '';

        if (mode !== 'terminal') {
            panel.messageClear();
            quickfix.quickfixReset();
        }

        if (mode === '') {
            panel.messageShow();
        }

        if (options.save === true) {
            const editor = atom.workspace.getActiveTextEditor();
            if (editor) {
                try {
                    editor.save();
                } catch (e) {
                    // nothing to do
                }
            }
        }

        // Announcing launch
        const echo = JSON.stringify([command].concat(args));
        // const text = `> ${command} ${JSON.stringify(args)} cwd="${cwd}"`;

        if (mode !== 'terminal') {
            panel.messagePlain(echo, 'echo');
        }

        function output(text, style) {
            for (let i = 0; i < matchs.length; i += 1) {
                const result = XRegExp.XRegExp.exec(text, matchs[i]);
                if (result && result.file) {
                    let { file } = result;

                    if (!path.isAbsolute(file)) {
                        file = path.join(cwd, file);
                    }

                    const line = parseInt(result.line || '1', 10) || 1;
                    const col = parseInt(result.col || '1', 10) || 1;
                    const matchStyle = (style === 'stdout' || style === 'stderr') ? `${style}-match` : style;
                    const message = panel.messageLine(file, line, col, text, matchStyle);

                    panel.updateScroll();

                    if (message) {
                        let position = message.atompos;
                        if (position < 0) position = 0;
                        quickfix.quickfixPush(message, file, line, col, position, style);
                    }

                    return;
                }
            }

            panel.messagePlain(text, style);
            panel.updateScroll();
        }

        // record time
        const millisec = (new Date()).getTime();

        if (mode === 'terminal') {
            terminal.open_terminal(command, args, options);
            // panel.messagePlain("open new terminal to launch", "echo");
            return;
        }

        // Run the spawn, we pass args to make a shallow copy of the array because spawn will modify it.
        const proc = spawn(command, args, options);

        childs[proc.pid] = proc;

        let stdoutCache = '';
        let stderrCache = '';

        // Update console panel on data
        proc.stdout.on('data', (data) => {
            stdoutCache += data;
            for (;;) {
                const index = stdoutCache.indexOf('\n');
                if (index < 0) break;
                const text = stdoutCache.substring(0, index + 1);
                stdoutCache = stdoutCache.substring(index + 1);
                output(text, 'stdout');
            }
        });

        // Update console panel on error data
        proc.stderr.on('data', (data) => {
            stderrCache += data;
            for (;;) {
                const index = stderrCache.indexOf('\n');
                if (index < 0) break;
                const text = stderrCache.substring(0, index + 1);
                stderrCache = stderrCache.substring(index + 1);
                output(text, 'stderr');
            }
        });

        proc.stdout.on('close', () => {
            if (stdoutCache.length > 0) {
                output(stdoutCache, 'stdout');
                stdoutCache = '';
            }
        });

        proc.stderr.on('close', () => {
            if (stderrCache.length > 0) {
                output(stderrCache, 'stderr');
                stderrCache = '';
            }
        });

        // Register code for error
        proc.on('error', (msg) => {
            output(msg, 'error');
        });

        // Register code for termination
        proc.on('close', (code) => {
            const current = (new Date()).getTime();
            const delta = (current - millisec) * 0.001;
            const style = 'echo';
            if (code === null || code === undefined) {
                output(`[Finished in ${delta.toFixed(2)} seconds]`, style);
            } else if (code === 0) {
                output(`[Finished in ${delta.toFixed(2)} seconds]`, style);
            } else {
                output(`[Finished in ${delta.toFixed(2)} seconds, with code ${code.toString()}]`, style);
            }

            if (proc.pid in childs) {
                delete childs[proc.pid];
            }

            if (options.sound) {
                sounds.play(options.sound);
            }
        });
    },
};
