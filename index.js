'use strict';

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

module.exports = Manager;

/**
 * @param name
 * @param opts
 * @param filter
 * @constructor
 */
function Manager(name, opts, filter) {
    var me = this;
    
    me._npm = require.resolve('npm/bin/npm-cli');

    if ('function' === typeof opts) {
        filter = opts;
        opts = null;
    }

    if ('string' === typeof opts) {
        opts = {
            prefix: opts
        };
    }

    me._name = name;
    me._opts = opts || {
        prefix: process.cwd()
    };
    me._filter = filter || function(pkg) {
        if (pkg.hasOwnProperty(me._name)) {
            return true;
        }
        return false;
    };
}

/**
 * @param name
 */
Manager.prototype.require = function(name) {
    var me = this;
    if (me._opts['global']) {
        name = path.join(getNodeModulesGlobalDir(me), name);
    } else {
        name = path.join(me._opts['prefix'], 'node_modules', name);
    }
    return require(name);
};

/**
 * @param name
 * @param callback
 */
Manager.prototype.info = function(name, callback) {
    var me = this;
    if (/\//.test(name) && '@' !== name[0]) {
        if (!path.isAbsolute(name)) {
            name = path.join(process.cwd(), path.normalize(name));
        }
        fs.stat(name, function(err, stat) {
            try {
                if (stat && stat.isDirectory()) {
                    var pkg = require(path.join(name, 'package.json'));
                    if (me._filter(pkg)) {
                        return callback(null, pkg);
                    }
                }
                callback(null, false);

            } catch (e) {
                callback(e);
            }
        });

    } else {
        exec(me._npm + ' show ' + name + ' --json', function(err, stdout, stderr) {
            if (err) {
                return callback(err);
            }
            var pkg = JSON.parse(stdout);
            if (me._filter(pkg)) {
                return callback(null, pkg);
            }
            callback(null, false);
        });
    }
};

/**
 * @param name
 * @param callback
 */
Manager.prototype.package = function(name, callback) {
    var me = this;
    try {
        var pkg = me.require(path.join(name, 'package.json'));
        if (me._filter(pkg)) {
            return callback(null, pkg);
        }
    } catch (err) {
        return callback(err);
    }
    callback(null, false);
};

/**
 * @param callback
 */
Manager.prototype.list = function(callback) {
    var me = this;
    exec(me._npm + ' ls ' + optsToString(me._opts) + ' --depth=0 --json', function(err, stdout, stderr) {
        var data = [];
        var dependencies = JSON.parse(stdout)['dependencies'] || {};
        for (var name in dependencies) {
            var pkg = me.require(path.join(name, 'package.json'));
            if (me._filter(pkg)) {
                data.push(name);
            }
        }
        callback(null, data);
    });
};

/**
 * @param name
 * @param callback
 */
Manager.prototype.install = function(name, callback) {
    var me = this;
    me.info(name, function(err, pkg) {
        if (err) {
            return callback(err);
        }
        if (pkg) {
            var args = ('install ' + name + ' ' + optsToString(me._opts)).split(' ');
            var install = spawn(me._npm, args, { stdio: 'inherit' });
            install.on('close', function(code) {
                callback(null, pkg);
            });
            return;
        }
        callback(null, false);
    });
};

/**
 * @param name
 * @param callback
 */
Manager.prototype.remove = function(name, callback) {
    var me = this;
    me.package(name, function(err, pkg) {
        if (err) {
            return callback(err);
        }
        if (pkg) {
            exec(me._npm + ' remove ' + name + ' ' + optsToString(me._opts) + ' --json', function(err, stdout, stderr) {
                if (err) {
                    return callback(err);
                }
                callback(null, stdout || stderr);
            });
            return;
        }
        callback(null, false);
    });
};

// PRIVATE

/**
 * @param opts
 * @returns {string}
 */
function optsToString(opts) {
    var arr = [];
    for (var key in opts) {
        arr.push('--' + key + '=' + opts[key]);
    }
    return arr.join(' ');
}

/**
 * @param manager
 * @returns {*}
 */
function getNodeModulesGlobalDir(manager) {
    if (!manager._globalDir) {
        manager._globalDir = require('child_process').execSync(manager._npm + ' root -g');
    }

    return manager._globalDir;
}
