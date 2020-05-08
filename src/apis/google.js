'use strict';

const configs = require('configs');
const {google} = require('googleapis');

const oauth2Api = google.oauth2({
  version: 'v2',
  auth: configs.google.serverKey,
});

const youtubeApi = google.youtube({
  version: 'v3',
  auth: configs.google.serverKey,
});

exports.api = {
  oauth2: oauth2Api,
  youtube: youtubeApi,
};

exports.getOauth2 = async (authCode) => {
  const oauth2 = new google.auth.OAuth2(configs.google.oauth2.clientId, configs.google.oauth2.clientSecret);
  const {tokens} = await oauth2.getToken(authCode);
  oauth2.setCredentials(tokens);
  return oauth2;
};

exports.getOauth2WithTokens = (tokens) => {
  const oauth2 = new google.auth.OAuth2(configs.google.oauth2.clientId, configs.google.oauth2.clientSecret);
  oauth2.setCredentials(tokens);
  return oauth2;
};
