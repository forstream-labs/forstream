'use strict';

const configs = require('configs');
const Promise = require('bluebird');
const {Facebook} = require('fb');

const graphApi = new Facebook({version: 'v7.0', Promise});

exports.api = graphApi.extend({
  appId: configs.facebook.appId,
  appSecret: configs.facebook.appSecret,
}).api;

exports.getLongLivedAccessToken = async (accessToken) => {
  const longLivedAccessToken = await graphApi.api('oauth/access_token', 'GET', {
    grant_type: 'fb_exchange_token',
    client_id: configs.facebook.appId,
    client_secret: configs.facebook.appSecret,
    fb_exchange_token: accessToken,
  });
  return longLivedAccessToken;
};
