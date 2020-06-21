'use strict';

const configs = require('configs');
const {google} = require('googleapis');
const pubSub = require('pubsub-js');

const oauth2Api = google.oauth2({
  version: 'v2',
  auth: configs.google.serverKey,
});

const youtubeApi = google.youtube({
  version: 'v3',
  auth: configs.google.serverKey,
});

exports.oauth2 = oauth2Api;
exports.youtube = youtubeApi;

exports.getOauth2 = async (authCode) => {
  const oauth2 = new google.auth.OAuth2(configs.google.oauth2.clientId, configs.google.oauth2.clientSecret);
  const {tokens} = await oauth2.getToken(authCode);
  oauth2.setCredentials(tokens);
  return oauth2;
};

exports.getOauth2FromConnectedChannel = (connectedChannel) => {
  const oauth2 = new google.auth.OAuth2(configs.google.oauth2.clientId, configs.google.oauth2.clientSecret);
  oauth2.setCredentials(connectedChannel.oauth2);
  oauth2.on('tokens', (tokens) => {
    pubSub.publish('token_refreshed', {
      credentials: {
        access_token: tokens.access_token,
        expiry_date: new Date(tokens.expiry_date),
      },
      connected_channel: connectedChannel,
    });
  });
  return oauth2;
};
