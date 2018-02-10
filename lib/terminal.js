'use babel';

import os from 'os';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawn } from 'child_process';

const dirname = __dirname;
const vendor = path.resolve(dirname, '../vendor');
const osname = os.type();

function searchBin(name, locations) {
    const win32 = osname === 'Windows_NT';
    if (process.env.PATH) {
        let { PATH } = process.env;
        if (win32) {
            PATH = PATH.split(';');
        } else {
            PATH = PATH.split(':');
        }
        for (let i = 0; i < PATH.length; i += 1) {
            const filepath = path.join(PATH[i], name);
            try {
                fs.accessSync(filepath, fs.F_OK);
                return win32 ? filepath.split('/').join('\\') : filepath;
            } catch (e) {
                // nothing to do
            }
        }
    }
    if (locations) {
        for (let i = 0; i < locations.length; i += 1) {
            const filepath = path.join(locations[i], name);
            try {
                fs.accessSync(filepath, fs.F_OK);
                return win32 ? filepath.split('/').join('\\') : filepath;
            } catch (e) {
                // nothing to do
            }
        }
    }
    return undefined;
}

let cmd;
// let gnomeTerminal;
// let xterm;

if (osname === 'Windows_NT') {
    const loc = ['C:/Windows/System32', 'C:/Windows/SysWOW64'];
    loc.push('C:/WinNT/System32');
    loc.push('C:/WinNT/SysWOW64');
    cmd = searchBin('cmd.exe', loc);
    cmd = cmd.split('/').join('\\');
} else if (osname === 'Linux') {
    // gnomeTerminal = searchBin('gnome-terminal', ['/bin', '/usr/bin']);
    // xterm = searchBin('xterm', ['/bin', '/usr/bin']);
}

export default {
    open_windows(command, argv, options) {
        let argument = ['/C', 'start', cmd, '/C'];
        argument.push(path.join(vendor, 'launch.cmd'));
        argument.push(command);
        argument = argument.concat(argv);
        // options.detached = true;
        // options.stdout = 'ignore';
        // options.stderr = 'ignore';
        // options.shell = false;
        // if (false) {
        //     command = 'cmd.exe';
        //     argument = ['/C', 'start', cmd, '/C', 'echo', 'fuck'];
        // }
        spawn(cmd, argument, options);
    },

    // open_linux_gnome(command, argv, options) {
    // },
    //
    // open_linux_xterm(command, argv, options) {
    // },
    //
    // open_darwin_terminal(command, argv, options) {
    // },

    open_terminal(command, argv, options) {
        const modOptions = Object.assign(options, {
            detached: true,
            stdout: 'ignore',
            stderr: 'ignore',
            shell: false,
        });
        if (osname === 'Windows_NT') {
            this.open_windows(command, argv, modOptions);
        } else if (osname === 'Linux') {
            // const terminal = 'xterm';
        }
    },
};
