# nmpm

Node modules package manager

## Install

```sh
$ npm install nmpm
```

nmpm depends on [Node.js](http://nodejs.org/) and [npm](http://npmjs.org/).

## Usage

```js
const Manager = require('nmpm');

const manager = new Manager('manager-name');

manager.list().then(result => {}, error => {});

manager.import('package-name').then(result => {}, error => {});

manager.package('package-name').then(result => {}, error => {});

manager.install('package-name', satisfies = async (pkg) => {}).then(result => {}, error => {});

manager.remove('package-name').then(result => {}, error => {});

```

### Configure manager

```js
const opts = {
    'fund': false,
    'audit': false,
    'loglevel': 'error',
    'global-style': true,
    'package-lock': false,
    'prefix': './plugins' // by default `process.cwd()`
};

const filter = async (pkg) => {
    if (!pkg.hasOwnProperty('manager-name')) {
        throw new Error('Package `' + pkg['name'] + '@' + pkg['version'] + '` is not supported');
    }
};

const throwPackageNotFound = (name) => {
    throw new Error('Unable to locate package `' + name + '`');
};

const manager = new Manager('manager-name', { opts, filter, throwPackageNotFound });
```

### Dynamic import

```js
const Module = require('module');
if (!Module.prototype.import) {
    Module.prototype.import = function(id) {
        return import(Module._resolveFilename(id, this, false)).catch(err => {
            if ('ERR_UNKNOWN_FILE_EXTENSION' == err.code) {
                return Promise.resolve({ default: this.require(id) });
            }
            throw err;
        });
    };
}
```

## Package example

```json
{
  "name": "package-name",
  "manager-name": true,
  ...
}
```

## Install with satisfies check

```js
const semver = require('semver');

const satisfies = async (pkg) => {
    if (pkg['engines']) {
        if (pkg['engines']['node']) {
            if (!semver.satisfies(semver.coerce(process.version), pkg['engines']['node'])) {
                throw new Error(
                    'Package `' + pkg['name'] + '@' + pkg['version'] + '` require `node@' + pkg['engines']['node'] + '`'
                );
            }
        }
    }
};

manager.install('package-name', satisfies).then(result => {}, error => {});
```

## License

This software is under the MIT license. See the complete license in:

```
LICENSE
```