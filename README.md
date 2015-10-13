# nmpm

Node modules package manager

## Install

```sh
$ npm install nmpm
```

nmpm depends on [Node.js](http://nodejs.org/) and [npm](http://npmjs.org/).

## Usage

```js

var Manager = require('nmpm');

var manager = new Manager('manager-name');

manager.list(function(names) {});

manager.info('package-name', function(err, pkg) {});

manager.package('package-name', function(err, pkg) {});

manager.install('package-name', function(err, pkg) {});

manager.remove('package-name', function(err, pkg) {});


```

## Package example

```json
{
  "name": "package-name",
  "manager-name": true,
  ...
}
```

## License

This software is under the MIT license. See the complete license in:

```
LICENSE
```