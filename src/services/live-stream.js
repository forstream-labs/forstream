'use strict';

const {LiveStream} = require('models');
const queries = require('utils/queries');

exports.getLiveStream = async (id, options) => queries.get(LiveStream, id, options);
