'use strict';

const configs = require('configs');
const Promise = require('bluebird');
const {Facebook} = require('fb');

const graphApi = new Facebook({version: 'v7.0', Promise});

module.exports = graphApi.extend({
  appId: configs.facebook.appId,
  appSecret: configs.facebook.appSecret,
});
