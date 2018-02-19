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

manager.install('package-name').then(result => {}, error => {});

manager.remove('package-name').then(result => {}, error => {});

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