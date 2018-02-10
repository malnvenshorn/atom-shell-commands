'use babel';

import fs from 'fs-plus';
import path from 'path';
import cson from 'cson';
import { CompositeDisposable } from 'atom';

import panel from './panel';
import quickfix from './quickfix';
import commands from './commands';

const subscriptions = new CompositeDisposable();

let configFilePath = null;
let projectConfigFilePath = null;

let currentProject = null;
let registeredAtomShellCommands = [];

function getProjectPath() {
    const editor = atom.workspace.getActivePaneItem();
    const buffer = (editor && editor.buffer) ? editor.buffer.file : null;
    const file = buffer || (editor ? editor.file : null);

    if (file && file.path) {
        return atom.project.relativizePath(file.path)[0];
    }

    return null;
}

function storeProject() {
    const project = getProjectPath();

    if (project !== currentProject) {
        currentProject = project || null;
        return true;
    }

    return false;
}

function createConfig(configPath) {
    try {
        fs.writeFileSync(configPath, '[]');
        atom.notifications.addInfo('Empty Shell Commands config file created...', {
            detail: configPath,
            dismissable: true,
        });
        return true;
    } catch (err) {
        atom.notifications.addError('Something went wrong creating the Shell Commands config file!', {
            detail: '#{configPath}\n\n#{err.stack ? err.toString()}',
            dismissable: true,
        });
        return false;
    }
}

function resolveConfigPath(
    filePath = atom.config.get('atom-shell-commands.configurationFilePath'),
    createIfNotFound = true,
) {
    let configPath = filePath;

    if (!fs.isFileSync(configPath)) {
        configPath = fs.resolve(configPath, 'shell-commands.cson');
    }

    if (configPath) {
        configFilePath = configPath;
        return true;
    } else if (createIfNotFound) {
        configPath = configFilePath;

        if (fs.isDirectorySync(configPath)) {
            configPath = path.resolve(configPath, 'shell-commands.cson');
        }

        if (createConfig(configPath)) {
            configFilePath = configPath;
            return true;
        }
    }

    return false;
}

function resolveProjectConfigPath(filePath = atom.config.get('atom-shell-commands.projectConfigurationFilePath')) {
    const projectRoot = getProjectPath();

    if (projectRoot) {
        let configPath = path.resolve(projectRoot, filePath);

        if (!fs.isFileSync(configPath)) {
            configPath = fs.resolve(configPath, 'shell-commands.cson');
        }

        if (configPath) {
            projectConfigFilePath = configPath;
            return true;
        }
    }

    return false;
}

function mergeConfigs(config1, config2) {
    config2.forEach((command2) => {
        const index = config1.findIndex(command1 => command1.name === command2.name);
        if (index > -1) {
            // replace command
            config1.splice(index, 1, command2);
        } else {
            // add new command
            config1.push(command2);
        }
    });
    return config1;
}

function loadConfig() {
    let config = [];

    if (configFilePath) {
        config = cson.requireCSONFile(configFilePath);
    }

    if (projectConfigFilePath) {
        const projConfig = cson.requireCSONFile(projectConfigFilePath);
        config = mergeConfigs(config, projConfig);
    }

    return config;
}

function reloadShellCommands() {
    const shellCommands = loadConfig();

    // Dispose old commands
    registeredAtomShellCommands.forEach((disposable) => {
        // Remove it from subscriptions and...
        subscriptions.remove(disposable);

        // ... dispose it manually
        disposable.dispose();
    });

    registeredAtomShellCommands = [];

    // Register new commands
    shellCommands.forEach((cmd) => {
        // Create an atom command for each entry
        const commandName = `atom-shell-commands:${cmd.name}`;
        const commandSelector = cmd.selector || 'atom-workspace';
        const atomCommand = atom.commands.add(commandSelector, commandName, () => {
            commands.execute(cmd);
        });

        // Create a menu entry for each command
        const menuEntry = atom.menu.add([{
            label: 'Packages',
            submenu: [{
                label: 'Atom Shell Commands',
                submenu: [
                    {
                        label: cmd.name,
                        command: commandName,
                    },
                ],
            }],
        }]);

        // Register it in the subscriptions;
        registeredAtomShellCommands.push(atomCommand);
        registeredAtomShellCommands.push(menuEntry);

        subscriptions.add(atomCommand);
        subscriptions.add(menuEntry);

        const options = cmd.options || {};
        const keymap = options.keymap || '';

        if (keymap) {
            const specifies = { 'atom-workspace': {} };
            specifies['atom-workspace'][keymap] = commandName;
            const keyname = `atom-shell-commands-keymap:${cmd.name}`;
            const entry = atom.keymaps.add(keyname, specifies);

            registeredAtomShellCommands.push(entry);
            subscriptions.add(entry);
        }
    });
}

function registerCommands() {
    const where = 'atom-workspace';
    const prefix = 'atom-shell-commands-config:';

    subscriptions.add(atom.commands.add(where, `${prefix}reload`, reloadShellCommands));
    subscriptions.add(atom.commands.add(where, `${prefix}toggle`, panel.toggle));
    subscriptions.add(atom.commands.add(where, `${prefix}stop`, commands.childStop));
    subscriptions.add(atom.commands.add(where, `${prefix}kill`, commands.childKill));
    subscriptions.add(atom.commands.add(where, `${prefix}error-first`, quickfix.quickfixFirst));
    subscriptions.add(atom.commands.add(where, `${prefix}error-last`, quickfix.quickfixLast));
    subscriptions.add(atom.commands.add(where, `${prefix}error-next`, quickfix.quickfixNext));
    subscriptions.add(atom.commands.add(where, `${prefix}error-prev`, quickfix.quickfixPrev));
}

function registerEvents() {
    subscriptions.add(atom.workspace.onDidStopChangingActivePaneItem(() => {
        if (storeProject()) {
            // project has changed
            resolveProjectConfigPath();
            reloadShellCommands();
        }
    }));

    subscriptions.add(atom.config.onDidChange('atom-shell-commands.configurationFilePath', ({ newValue }) => {
        resolveConfigPath(newValue, false);
        reloadShellCommands();
    }));

    subscriptions.add(atom.config.onDidChange('atom-shell-commands.projectConfigurationFilePath', ({ newValue }) => {
        resolveConfigPath(newValue, false);
        reloadShellCommands();
    }));
}

export default {
    config: {
        configurationFilePath: {
            type: 'string',
            default: atom.getConfigDirPath(),
        },
        projectConfigurationFilePath: {
            type: 'string',
            default: '.',
        },
    },

    activate() {
        storeProject();
        registerCommands();
        registerEvents();
        resolveConfigPath();
        resolveProjectConfigPath();
        reloadShellCommands();

        panel.init();
        quickfix.quickfixReset();
    },

    deactivate() {
        subscriptions.dispose();
        panel.remove();
        commands.childKill();
    },

    serialize() {},
};
