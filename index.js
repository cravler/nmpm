'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;

const NPM = process.env.NMPM_NPM_CLI || require.resolve('npm/bin/npm-cli');

const fsStat = util.promisify(fs.stat);
const fsUnlink = util.promisify(fs.unlink);

const npmSpawn = util.promisify((args, callback) => {
    const install = spawn(NPM, args, { stdio: 'inherit' });
    install.on('close', function(code) {
        callback(null, code);
    });
});

const npmExec = util.promisify((cmd, callback) => {
    exec(NPM + ' ' + cmd, (err, stdout, stderr) => {
        if (err) {
            return callback(err);
        }
        callback(null, { stdout, stderr });
    });
});

const optsToString = (opts) => {
    const arr = [];
    for (let key in opts) {
        if (undefined != opts[key]) {
            arr.push('--' + key + '=' + opts[key]);
        } else {
            arr.push('--' + key);
        }
    }
    return arr.join(' ');
};

const resolveName = async (value) =>  {
    try {
        const resolvedPath = path.resolve(value);
        const stat = await fsStat(resolvedPath);
        if (stat.isDirectory()) {
            return {
                type: 'folder',
                value: resolvedPath
            };
        }
    } catch (e) {}

    return {
        type: 'name',
        value: value
    };
};

class Manager {
    /**
     * @api public
     * @param id
     */
    static async import(id) {
        if (module.import) {
            return await module.import(id);
        }
        return { default: module.require(id) };
    }

    /**
     * @api public
     * @param name
     * @param config
     */
    constructor(name, { opts, filter } = {}) {
        if (!opts) {
            opts = {
                prefix: process.cwd()
            };
        }

        if (!filter) {
            filter = (pkg) => {
                if (pkg.hasOwnProperty(this._name)) {
                    return true;
                }
                return false;
            };
        }

        this._name = name;
        this._opts = opts;
        this._filter = filter;
    }

    /**
     * @api public
     * @param name
     */
    async import(name) {
        if (this._opts['global']) {
            const cmd = 'root -g --no-update-notifier';
            const { stdout } = await npmExec(cmd);
            name = path.join(stdout, name);
        } else {
            name = path.join(this._opts['prefix'], 'node_modules', name);
        }

        return await Manager.import(name);
    }

    /**
     * @api public
     * @param name
     */
    async info(name) {
        const resolved = await resolveName(name);

        if ('folder' == resolved['type']) {
            const { default: pkg } = await Manager.import(path.join(resolved['value'], 'package.json'));
            if (await this._filter(pkg)) {
                return pkg;
            }

        } else if ('name' == resolved['type']) {
            const cmd = 'show ' + resolved['value'] + ' --json --no-update-notifier';
            const { stdout } = await npmExec(cmd);
            const pkg = JSON.parse(stdout);
            if (await this._filter(pkg)) {
                return pkg;
            }
        }

        return false;
    }

    /**
     * @api public
     * @param name
     */
    async package(name) {
        const { default: pkg } = await this.import(path.join(name, 'package.json'));
        if (await this._filter(pkg)) {
            return pkg;
        }
        return false;
    }

    /**
     * @api public
     */
    async list() {
        const cmd = 'ls ' + optsToString(this._opts) + ' --depth=0 --json --no-update-notifier';
        const { stdout } = await npmExec(cmd);

        const data = [];
        const dependencies = JSON.parse(stdout)['dependencies'] || {};
        for (let name in dependencies) {
            const { default: pkg } = await this.import(path.join(name, 'package.json'));
            if (await this._filter(pkg)) {
                data.push(name);
            }
        }
        return data;
    }

    /**
     * @api public
     * @param name
     */
    async install(name) {
        const pkg = await this.info(name);
        if (pkg) {
            const resolved = await resolveName(name);

            // prevent symlinks
            let cleaning = async () => {};
            if ('folder' == resolved['type']) {
                const cmd = 'pack ' + resolved['value'] + ' --no-update-notifier';
                const { stdout } = await npmExec(cmd);
                resolved['value'] = path.resolve(stdout.split('\n')[0]);
                cleaning = async () => {
                    await fsUnlink(resolved['value']);
                };
            }

            try {
                const cmd = 'install ' + resolved['value'] + ' ' + optsToString(this._opts) + ' --no-update-notifier';
                const code = await npmSpawn(cmd.split(' '));
                await cleaning();
            } catch (e) {
                await cleaning();
                throw e;
            }

            return pkg;
        }
        return false;
    }

    /**
     * @api public
     * @param name
     */
    async remove(name) {
        const pkg = await this.package(name);
        if (pkg) {
            const cmd = 'remove ' + name + ' ' + optsToString(this._opts) + ' --json --no-update-notifier';
            const { stdout, stderr } = await npmExec(cmd);
            return stdout || stderr;
        }
        return false;
    }
}

module.exports = Manager;
