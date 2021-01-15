const fs = require('fs');
const url = require('url');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const http = require('http');
const https = require('https');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const readChunk = require('read-chunk');
const fileType = require('file-type');
const tar = require('tar-stream');

//process.env.NMPM_NPM_CLI = require.resolve('npm/bin/npm-cli');
const NPM = process.env.NMPM_NPM_CLI || 'npm';

const fsStat = util.promisify(fs.stat);

const fsUnlink = util.promisify(fs.unlink);

const readUrlChunk = (value) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(value);
        if (parsedUrl.protocol) {
            const request = ('https:' == parsedUrl.protocol ? https : http).get(value, res => {
                res.once('data', chunk => {
                    res.destroy();
                    resolve(chunk);
                });
            });
            request.on('error', (err) => reject(err));
        } else {
            reject(new Error('Not URL'))
        }
    });
};

const readTarballPkg = (opts) => {
    return new Promise((resolve, reject) => {
        let data = '';
        const extract = tar.extract();
        extract.on('entry', (header, stream, cb) => {
            stream.on('data', (chunk) => {
                if (header.name.endsWith('/package.json')) {
                    data += chunk;
                }
            });
            stream.on('end', () => cb());
            stream.resume();
        });
        extract.on('finish', () => {
            let json = {};
            try {
                json = JSON.parse(data);
            } catch (e) {}
            resolve(json);
        });

        if ('tarball_url' == opts['type']) {
            const parsedUrl = url.parse(opts['value']);
            if (parsedUrl.protocol) {
                const request = ('https:' == parsedUrl.protocol ? https : http).get(opts['value'], res => {
                    res.pipe(zlib.createGunzip()).pipe(extract);
                });
                request.on('error', (err) => reject(err));
            } else {
                reject(new Error('Not URL'))
            }
        } else {
            fs.createReadStream(opts['value']).pipe(zlib.createGunzip()).pipe(extract);
        }
    });
};

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

const isTarball = (value) => {
    const type = fileType.fromFile(value);
    return type && ['tar', 'gz'].includes(type['ext']);
};

const isTarballFile = async (value) => {
    return isTarball(await readChunk(value, 0, 4100));
};

const isTarballUrl = async (value) => {
    return isTarball(await readUrlChunk(value));
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
        } else if (stat.isFile() && await isTarballFile(resolvedPath)) {
            return {
                type: 'tarball_file',
                value: resolvedPath
            };
        }
    } catch (e) {
        try {
            if (await isTarballUrl(value)) {
                return {
                    type: 'tarball_url',
                    value: value
                };
            }
        } catch (e) {}
    }

    return {
        type: 'name',
        value: value
    };
};

const resolvePath = async (value, opts) =>  {
    if (opts['global']) {
        const cmd = 'root -g --no-update-notifier';
        const { stdout } = await npmExec(cmd);
        return path.join(stdout, value);
    }
    return path.join(opts['prefix'], 'node_modules', value);
};

const isNewerVersion = (oldVer, newVer) => {
    const oldParts = oldVer.split('.');
    const newParts = newVer.split('.');
    for (let i = 0; i < newParts.length; i++) {
        const a = ~~newParts[i]; // parse int
        const b = ~~oldParts[i]; // parse int
        if (a > b) {
            return true;
        }
        if (a < b) {
            return false;
        }
    }
    return false;
};

module.exports = {
    fsStat,
    fsUnlink,
    readUrlChunk,
    readTarballPkg,
    npmSpawn,
    npmExec,
    optsToString,
    isTarball,
    isTarballFile,
    isTarballUrl,
    resolveName,
    resolvePath,
    isNewerVersion,
};
