'use strict';

const configs = require('configs');
const TwitchClient = require('twitch').default;
const pubSub = require('pubsub-js');

const REDIRECT_URL = 'io.forstream.api:/oauth2/twitch';

exports.getCredentials = async (authCode) => {
  const token = await TwitchClient.getAccessToken(configs.twitch.clientId, configs.twitch.clientSecret, authCode, REDIRECT_URL);
  return {
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate,
  };
};

exports.getClient = (credentials, connectedChannel) => {
  return TwitchClient.withCredentials(configs.twitch.clientId, credentials.access_token, undefined, {
    clientSecret: configs.twitch.clientSecret,
    refreshToken: credentials.refresh_token,
    expiry: credentials.expiry_date,
    onRefresh: (token) => {
      if (connectedChannel) {
        pubSub.publish('token_refreshed', {
          credentials: {
            access_token: token.accessToken,
            expiry_date: token.expiryDate,
          },
          connected_channel: connectedChannel,
        });
      }
    },
  });
};
