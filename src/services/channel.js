'use strict';

const configs = require('configs');
const googleApi = require('apis/google');
const facebookApi = require('apis/facebook');
const twitchApi = require('apis/twitch');
const queries = require('utils/queries');
const {constants} = require('@forstream/models');
const {Channel, ConnectedChannel, LiveStream, User} = require('@forstream/models').models;
const {logger} = require('@forstream/utils');
const pubSub = require('pubsub-js');

pubSub.subscribe('token_refreshed', async (msg, data) => {
  const connectedChannel = await queries.get(ConnectedChannel, data.owner.id, {populate: 'channel'});
  logger.info('[ConnectedChannel %s] Updating oauth2 config...', connectedChannel.id);
  connectedChannel.oauth2.set(data.credentials);
  await connectedChannel.save();
  logger.info('[ConnectedChannel %s] Oauth2 config updated!', connectedChannel.id);
});

function setupChannels() {
  setTimeout(async () => {
    const youtubeChannel = await queries.find(Channel, {identifier: constants.channel.identifier.YOUTUBE}, {require: false});
    if (!youtubeChannel) {
      await new Channel({
        name: 'YouTube',
        identifier: constants.channel.identifier.YOUTUBE,
        image_url: `${configs.assetsUrl}/channels/youtube.png`,
        required_scopes: ['https://www.googleapis.com/auth/youtube'],
        registration_date: new Date(),
      }).save();
    }
    const facebookChannel = await queries.find(Channel, {identifier: constants.channel.identifier.FACEBOOK}, {require: false});
    if (!facebookChannel) {
      await new Channel({
        name: 'Facebook',
        identifier: constants.channel.identifier.FACEBOOK,
        image_url: `${configs.assetsUrl}/channels/facebook.png`,
        required_scopes: ['publish_video', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
        registration_date: new Date(),
      }).save();
    }
    const twitchChannel = await queries.find(Channel, {identifier: constants.channel.identifier.TWITCH}, {require: false});
    if (!twitchChannel) {
      await new Channel({
        name: 'Twitch',
        identifier: constants.channel.identifier.TWITCH,
        image_url: `${configs.assetsUrl}/channels/twitch.png`,
        required_scopes: ['openid', 'channel_read', 'channel_editor'],
        registration_date: new Date(),
      }).save();
    }
  }, 5000);
}

async function connectChannel(user, identifier, targetId, oauth2) {
  const channel = await queries.find(Channel, {identifier});
  let connectedChannel = await queries.find(ConnectedChannel, {user: user.id, channel: channel.id}, {require: false});
  if (!connectedChannel) {
    connectedChannel = new ConnectedChannel({
      user,
      channel,
      registration_date: new Date(),
    });
  }
  connectedChannel.set({oauth2, target_id: targetId});
  return connectedChannel.save();
}

exports.listChannels = async (options) => queries.list(Channel, null, options);

exports.listConnectedChannels = async (user, options) => queries.list(ConnectedChannel, {user: user.id}, options);

exports.connectYouTubeChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting YouTube channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating oauth2 config...', user.id);
  const oauth2 = await googleApi.getOauth2(authCode);
  const oauth2Config = {
    access_token: oauth2.credentials.access_token,
    refresh_token: oauth2.credentials.refresh_token,
    expiry_date: new Date(oauth2.credentials.expiry_date),
  };

  logger.info('[User %s] Getting target id...', user.id);
  const channels = await googleApi.youtube.channels.list({auth: oauth2, part: 'id', mine: true});
  const targetId = channels.data.items[0].id;

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.YOUTUBE, targetId, oauth2Config);
  logger.info('[User %s] YouTube channel connected: %s', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.listFacebookChannelTargets = async (user, accessToken) => {
  logger.info('[User %s] Getting profile...', user.id);
  const profile = await facebookApi.api('me', {access_token: accessToken});
  logger.info('[User %s] Listing pages...', user.id);
  const pages = await facebookApi.api('me/accounts', {access_token: accessToken});
  const targets = [
    {id: profile.id, name: profile.name},
    ...pages.data.map((page) => { return {id: page.id, name: page.name}; }),
  ];
  logger.info('[User %s] %s target(s) found', user.id, targets.length);
  return targets;
};

exports.connectFacebookChannel = async (user, accessToken, targetId) => {
  logger.info('[User %s] Connecting Facebook channel %s...', user.id, targetId);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting profile...', user.id);
  const profile = await facebookApi.api('me', {access_token: accessToken});
  logger.info('[User %s] Getting long lived access token...', user.id);
  const longLivedAccessToken = await facebookApi.getLongLivedAccessToken(accessToken);
  const oauth2Config = {};
  if (profile.id === targetId) {
    oauth2Config.access_token = longLivedAccessToken.access_token;
  } else {
    logger.info('[User %s] Target is a page, getting long lived page access token...', user.id);
    const page = await facebookApi.api(targetId, {fields: 'access_token', access_token: longLivedAccessToken.access_token});
    oauth2Config.access_token = page.access_token;
  }
  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.FACEBOOK, targetId, oauth2Config);
  logger.info('[User %s] Facebook channel %s connected: %s', loadedUser.id, targetId, connectedChannel.id);
  return connectedChannel;
};

exports.connectTwitchChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting Twitch channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating oauth2 config...', user.id);
  const oauth2Config = await twitchApi.getCredentials(authCode);

  logger.info('[User %s] Getting target id...', user.id);
  const twitchClient = twitchApi.getClient(oauth2Config);
  const twitchUser = await twitchClient.helix.users.getMe(false);

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.TWITCH, twitchUser.name, oauth2Config);
  logger.info('[User %s] Twitch channel connected: %s', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.disconnectChannel = async (user, channel) => {
  const loadedChannel = await queries.find(Channel, {identifier: channel});
  const connectedChannel = await queries.find(ConnectedChannel, {user: user.id, channel: loadedChannel.id});
  const liveStreams = await queries.list(LiveStream, {'providers.connected_channel': connectedChannel.id});
  liveStreams.forEach(async (liveStream) => {
    const providerStream = liveStream.providers.find((provider) => provider.connected_channel.toString() === connectedChannel.id);
    if (providerStream.stream_status === constants.streamStatus.COMPLETE) {
      providerStream.set({connected_channel: null});
    } else {
      providerStream.remove();
    }
    await liveStream.save();
  });
  await connectedChannel.remove();
};

exports.getConnectedChannel = async (id, options) => queries.get(ConnectedChannel, id, options);

setupChannels();
