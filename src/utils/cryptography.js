'use strict';

const Promise = require('bluebird');
const bcrypt = Promise.promisifyAll(require('bcrypt'));

exports.hash = async (data) => bcrypt.hash(data, 10);

exports.compare = async (data, hash) => bcrypt.compare(data, hash);
