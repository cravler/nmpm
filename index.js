'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;

const NPM = require.resolve('npm/bin/npm-cli');

const fsStat = util.promisify(fs.stat);

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

class Manager {
    /**
     * @api public
     * @param id
     */
    static async import(id) {
        if (module.import) {
            return await module.import(id);
        }
        return module.require(id);
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
        if (/\//.test(name) && '@' !== name[0]) {
            if (!path.isAbsolute(name)) {
                name = path.join(process.cwd(), path.normalize(name));
            }
            let isDirectory =false;
            try {
                const stat = await fsStat(name);
                isDirectory = stat.isDirectory();
            } catch (e) {}

            if (isDirectory) {
                const pkg = await Manager.import(path.join(name, 'package.json'));
                if (await this._filter(pkg)) {
                    return pkg;
                }
            }
            return false;

        } else {
            const cmd = 'show ' + name + ' --json --no-update-notifier';
            const { stdout } = await npmExec(cmd);
            const pkg = JSON.parse(stdout);
            if (await this._filter(pkg)) {
                return pkg;
            }
            return false;
        }
    }

    /**
     * @api public
     * @param name
     */
    async package(name) {
        const pkg = await this.import(path.join(name, 'package.json'));
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
            const pkg = await this.import(path.join(name, 'package.json'));
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
            const cmd = 'install ' + name + ' ' + optsToString(this._opts) + ' --no-update-notifier';
            const code = await npmSpawn(cmd.split(' '));
            return pkg;
        }
        return false;
    }

    /**
     * @api public
     * @param name
     */
    async remove(name) {
        const pkg = this.package(name);
        if (pkg) {
            const cmd = 'remove ' + name + ' ' + optsToString(this._opts) + ' --json --no-update-notifier';
            const { stdout, stderr } = await npmExec(cmd);
            return stdout || stderr;
        }
        return false;
    }
}

module.exports = Manager;
