'use strict';

const configs = require('configs');
// eslint-disable-next-line import/no-self-import
const TwitchClient = require('twitch').default;
const pubSub = require('pubsub-js');

const REDIRECT_URL = 'io.forstream.api:/oauth2/twitch';

exports.getTokens = async (authCode) => {
  const tokens = await TwitchClient.getAccessToken(configs.twitch.clientId, configs.twitch.clientSecret, authCode, REDIRECT_URL);
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
    scopes: tokens.scope,
  };
};

exports.getClient = (tokens, owner) => {
  const refreshConfig = {
    clientSecret: configs.twitch.clientSecret,
    refreshToken: tokens.refresh_token,
    expiry: tokens.expiry_date,
    onRefresh: (refreshedTokens) => {
      if (owner) {
        pubSub.publish('token_refreshed', {
          owner,
          tokens: {
            access_token: refreshedTokens.accessToken,
            expiry_date: refreshedTokens.expiryDate,
          },
        });
      }
    },
  };
  return TwitchClient.withCredentials(configs.twitch.clientId, tokens.access_token, tokens.scopes, refreshConfig);
};
