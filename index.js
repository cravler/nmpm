'use strict';

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;

/**
 * @param name
 * @param prefix
 * @param filter
 * @constructor
 */
var Manager = function(name, prefix, filter) {
    var me = this;

    if (typeof prefix === 'function') {
        filter = prefix;
        prefix = null;
    }

    me._name = name;
    me._prefix = prefix || process.cwd();
    me._filter = filter || function(pkg) {
        if (pkg.hasOwnProperty(me._name)) {
            return true;
        }
        return false;
    };
};

/**
 * @param name
 * @param callback
 */
Manager.prototype.info = function(name, callback) {
    var me = this;
    if (/\//.test(name)) {
        if (!path.isAbsolute(name)) {
            name = path.join(process.cwd(), path.normalize(name));
        }
        try {
            var stat = fs.statSync(name);
            if (stat && stat.isDirectory()) {
                me.package(name, function(err, pkg) {
                    if (err) {
                        return callback(err, null);
                    }
                    callback(null, pkg);
                });
            } else {
                callback(null, false);
            }
        } catch (e) {
            callback(e, null);
        }
    } else {
        exec('npm show ' + name + ' --json', function(err, stdout, stderr) {
            if (err) {
                return callback(err, null);
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
        var pkg = require(name + '/package.json');
        if (me._filter(pkg)) {
            return callback(null, pkg);
        }
    } catch (err) {
        return callback(err, null);
    }
    callback(null, false);
};

/**
 * @param callback
 */
Manager.prototype.list = function(callback) {
    var me = this;
    exec('npm ls --prefix=' + me._prefix + ' --depth=0 --json', function(err, stdout, stderr) {
        var data = [];
        var dependencies = JSON.parse(stdout)['dependencies'] || {};
        for (var name in dependencies) {
            var pkg = require(name + '/package.json');
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
            return callback(err, null);
        }
        if (pkg) {
            exec('npm install ' + name + ' --prefix=' + me._prefix + ' --json', function(err, stdout, stderr) {
                if (err) {
                    return callback(err, null);
                }
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
            return callback(err, null);
        }
        if (pkg) {
            exec('npm remove ' + name + ' --prefix=' + me._prefix + ' --json', function(err, stdout, stderr) {
                if (err) {
                    return callback(err, null);
                }
                callback(null, stdout || stderr);
            });
            return;
        }
        callback(null, false);
    });
};

module.exports = Manager;
