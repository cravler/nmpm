const path = require('path');
const util = require('./util');

class Manager {
    /**
     * @param {string} id
     */
    static async import(id) {
        if (module.import) {
            return await module.import(id);
        }
        return { default: module.require(id) };
    }

    /**
     * @param {string} name
     * @param {Object} config
     */
    constructor(name, { opts, filter, throwPackageNotFound } = {}) {
        if (!opts) {
            opts = {
                prefix: process.cwd()
            };
        }

        if (!filter) {
            filter = async (pkg) => {
                if (!pkg.hasOwnProperty(this._name)) {
                    throw new Error('Package `' + pkg['name'] + '@' + pkg['version'] + '` is not supported');
                }
            };
        }

        if (!throwPackageNotFound) {
            throwPackageNotFound = (name) => {
                throw new Error('Unable to locate package `' + name + '`');
            };
        }

        this._name = name;
        this._opts = opts;
        this._filter = filter;
        this._throwPackageNotFound = throwPackageNotFound;

        this._minSupportedNpmVersion = '6.14.5';
        this._npmVersionCheck = async () => {
            if (!this._npmVersion) {
                const { stdout, stderr } = await util.npmExec('-v');
                this._npmVersion = stdout.trim();
            }

            if (this._npmVersion !== this._minSupportedNpmVersion) {
                if (!util.isNewerVersion(this._minSupportedNpmVersion, this._npmVersion)) {
                    throw new Error(
                        'unsupported NPM version, require `npm@>=' + this._minSupportedNpmVersion + '`'
                    );
                }
            }
        };
    }

    /**
     * Import package
     *
     * @param {string} name
     * @returns {*}
     */
    async import(name) {
        name = await util.resolvePath(name, this._opts);

        return await Manager.import(name);
    }

    /**
     * Package info
     *
     * @param {string} name
     * @returns {Object}
     */
    async info(name) {
        const resolved = await util.resolveName(name);

        if ('folder' == resolved['type']) {
            const { default: pkg } = await Manager.import(path.join(resolved['value'], 'package.json'));
            if (false !== await this._filter(pkg)) {
                return pkg;
            }
        } else if (['tarball_file', 'tarball_url'].includes(resolved['type'])) {
            const pkg = await util.readTarballPkg(resolved);
            if (false !== await this._filter(pkg)) {
                return pkg;
            }
        } else if ('name' == resolved['type']) {
            try {
                const cmd = 'show ' + resolved['value'] + ' --json --no-update-notifier';
                const { stdout, stderr } = await util.npmExec(cmd);
                const pkg = JSON.parse(stdout);
                if (false !== await this._filter(pkg)) {
                    return pkg;
                }
            } catch (e) {}
        }

        this._throwPackageNotFound(name);
    }

    /**
     * Installed package info
     *
     * @param {string} name
     * @returns {Object}
     */
    async package(name) {
        const { default: pkg } = await this.import(path.join(name, 'package.json'));

        if (false !== await this._filter(pkg)) {
            return pkg;
        }

        this._throwPackageNotFound(name);
    }

    /**
     * Installed packages
     *
     * @returns {string[]}
     */
    async list() {
        const cmd = 'ls ' + util.optsToString(this._opts) + ' --depth=0 --json --no-update-notifier';
        const { stdout, stderr } = await util.npmExec(cmd);

        const data = [];
        const dependencies = JSON.parse(stdout)['dependencies'] || {};
        for (let name in dependencies) {
            const { default: pkg } = await this.import(path.join(name, 'package.json'));
            try {
                if (false !== await this._filter(pkg)) {
                    data.push(name);
                }
            } catch (e) {}
        }
        return data;
    }

    /**
     * Install package
     *
     * @param {string} name
     * @param {Promise} [satisfies]
     * @returns {Object}
     */
    async install(name, satisfies = async (pkg) => {}) {
        await this._npmVersionCheck();

        let pkg = null;

        try {
            pkg = await this.info(name);
        } catch (e) {}

        if (pkg && false !== await satisfies(pkg)) {
            const resolved = await util.resolveName(name);

            // prevent symlinks
            let cleaning = async () => {};
            if ('folder' == resolved['type']) {
                const cmd = 'pack ' + resolved['value'] + ' --no-update-notifier';
                const { stdout, stderr } = await util.npmExec(cmd);
                resolved['value'] = path.resolve(stdout.split('\n')[0]);
                cleaning = async () => {
                    await util.fsUnlink(resolved['value']);
                };
            }

            let exitCode;

            try {
                const cmd = 'install ' + resolved['value'] + ' ' + util.optsToString(this._opts) + ' --no-update-notifier';
                exitCode = await util.npmSpawn(cmd.split(' '));
                await cleaning();
            } catch (e) {
                await cleaning();
                throw e;
            }

            return { name, exitCode, pkg };
        }

        this._throwPackageNotFound(name);
    }

    /**
     * Remove package
     *
     * @param {string} name
     * @returns {Object}
     */
    async remove(name) {
        await this._npmVersionCheck();

        let pkg = null;

        try {
            pkg = await this.package(name);
        } catch (e) {}

        if (pkg) {
            const cmd = 'remove ' + name + ' ' + util.optsToString(this._opts) + ' --no-update-notifier';
            const exitCode = await util.npmSpawn(cmd.split(' '));
            return { name, exitCode };
        }

        this._throwPackageNotFound(name);
    }
}

module.exports = Manager;
