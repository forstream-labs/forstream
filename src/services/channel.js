'use strict';

const configs = require('configs');
const googleApi = require('apis/google');
const facebookApi = require('apis/facebook');
const twitchApi = require('apis/twitch');
const queries = require('utils/queries');
const {constants} = require('@forstream/models');
const {Channel, ConnectedChannel, LiveStream, User} = require('@forstream/models').models;
const {errors, logger} = require('@forstream/utils');
const {nanoid} = require('nanoid');
const pubSub = require('pubsub-js');

pubSub.subscribe('token_refreshed', async (msg, data) => {
  const connectedChannel = await queries.get(ConnectedChannel, data.owner.id, {populate: 'channel'});
  logger.info('[ConnectedChannel %s] Updating credentials...', connectedChannel.id);
  connectedChannel.credentials.set(data.tokens);
  await connectedChannel.save();
  logger.info('[ConnectedChannel %s] Credentials updated!', connectedChannel.id);
});

function setupChannels() {
  setTimeout(async () => {
    const youtubeChannel = await queries.find(Channel, {identifier: constants.channel.identifier.YOUTUBE}, {require: false});
    if (!youtubeChannel) {
      await new Channel({
        name: 'YouTube',
        identifier: constants.channel.identifier.YOUTUBE,
        image_url: `${configs.assetsUrl}/channels/youtube.png`,
        presentation_order: 1,
        required_scopes: ['https://www.googleapis.com/auth/youtube'],
        registration_date: new Date(),
      }).save();
    }
    const facebookChannel = await queries.find(Channel, {identifier: constants.channel.identifier.FACEBOOK}, {require: false});
    if (!facebookChannel) {
      await new Channel({
        name: 'Facebook Profile',
        identifier: constants.channel.identifier.FACEBOOK,
        image_url: `${configs.assetsUrl}/channels/facebook.png`,
        presentation_order: 2,
        required_scopes: ['user_link', 'publish_video'],
        registration_date: new Date(),
      }).save();
    }
    const facebookPageChannel = await queries.find(Channel, {identifier: constants.channel.identifier.FACEBOOK_PAGE}, {require: false});
    if (!facebookPageChannel) {
      await new Channel({
        name: 'Facebook Page',
        identifier: constants.channel.identifier.FACEBOOK_PAGE,
        image_url: `${configs.assetsUrl}/channels/facebook_page.png`,
        presentation_order: 3,
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
        presentation_order: 4,
        required_scopes: ['openid', 'channel_read', 'channel_editor'],
        registration_date: new Date(),
      }).save();
    }
    const customRtmpChannel = await queries.find(Channel, {identifier: constants.channel.identifier.RTMP}, {require: false});
    if (!customRtmpChannel) {
      await new Channel({
        name: 'Custom RTMP',
        identifier: constants.channel.identifier.RTMP,
        image_url: `${configs.assetsUrl}/channels/rtmp.png`,
        presentation_order: 5,
        registration_date: new Date(),
      }).save();
    }
  }, 5000);
}

async function connectChannel(user, identifier, target, credentials) {
  const channel = await queries.find(Channel, {identifier});
  let connectedChannel = await queries.find(ConnectedChannel, {user: user.id, channel: channel.id}, {require: false});
  if (!connectedChannel) {
    connectedChannel = new ConnectedChannel({
      user,
      channel,
      registration_date: new Date(),
    });
  }
  connectedChannel.set({target, credentials});
  return connectedChannel.save();
}

exports.listChannels = async (options) => {
  const finalOptions = options || {};
  finalOptions.sort = finalOptions.sort || {presentation_order: 'asc'};
  return queries.list(Channel, null, finalOptions);
};

exports.listConnectedChannels = async (user, options) => queries.list(ConnectedChannel, {user: user.id}, options);

exports.connectYouTubeChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting YouTube channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating credentials...', user.id);
  const oauth2 = await googleApi.getOauth2FromAuthCode(authCode);
  const credentials = {
    access_token: oauth2.credentials.access_token,
    refresh_token: oauth2.credentials.refresh_token,
    expiry_date: new Date(oauth2.credentials.expiry_date),
  };

  logger.info('[User %s] Getting channel info...', user.id);
  const channels = await googleApi.youtube.channels.list({auth: oauth2, part: 'id,snippet', mine: true});
  const channel = channels.data.items[0];
  const target = {
    id: channel.id,
    name: channel.snippet.title,
    url: `https://www.youtube.com/channel/${channel.id}`,
  };

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.YOUTUBE, target, credentials);
  logger.info('[User %s] YouTube channel connected: %s', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectFacebookChannel = async (user, accessToken) => {
  logger.info('[User %s] Connecting Facebook channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting long lived access token...', user.id);
  const longLivedAccessToken = await facebookApi.getLongLivedAccessToken(accessToken);

  logger.info('[User %s] Getting profile info...', user.id);
  const profile = await facebookApi.api('me', {fields: 'name,link', access_token: accessToken});
  const target = {id: profile.id, name: profile.name, url: profile.link};

  logger.info('[User %s] Generating credentials...', user.id);
  const credentials = {access_token: longLivedAccessToken.access_token};

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.FACEBOOK, target, credentials);
  logger.info('[User %s] Facebook channel connected: %s', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.listFacebookPageChannelTargets = async (user, accessToken) => {
  logger.info('[User %s] Listing pages...', user.id);
  const pages = await facebookApi.api('me/accounts', {access_token: accessToken});
  const targets = pages.data.map((page) => { return {id: page.id, name: page.name}; });
  logger.info('[User %s] %s target(s) found', user.id, targets.length);
  return targets;
};

exports.connectFacebookPageChannel = async (user, accessToken, targetId) => {
  logger.info('[User %s] Connecting Facebook page channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting long lived access token...', user.id);
  const longLivedAccessToken = await facebookApi.getLongLivedAccessToken(accessToken);

  logger.info('[User %s] Getting page info...', user.id);
  const page = await facebookApi.api(targetId, {fields: 'name,link,access_token', access_token: longLivedAccessToken.access_token});
  const target = {id: page.id, name: page.name, url: page.link};

  logger.info('[User %s] Generating credentials...', user.id);
  const credentials = {access_token: page.access_token};

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.FACEBOOK_PAGE, target, credentials);
  logger.info('[User %s] Facebook page channel connected: %s', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectTwitchChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting Twitch channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating credentials...', user.id);
  const credentials = await twitchApi.getTokens(authCode);

  logger.info('[User %s] Getting channel info...', user.id);
  const twitchClient = twitchApi.getClient(credentials);
  const twitchUser = await twitchClient.helix.users.getMe(false);
  const target = {
    id: twitchUser.id,
    name: twitchUser.name,
    url: `https://twitch.tv/${twitchUser.name}`,
  };

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.TWITCH, target, credentials);
  logger.info('[User %s] Twitch channel connected: %s', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectRtmpChannel = async (user, channelName, rtmpUrl, streamKey) => {
  if (!channelName) {
    throw errors.apiError('channel_name_required', 'Channel name is required');
  }
  if (!rtmpUrl) {
    throw errors.apiError('rtmp_url_required', 'RTMP url is required');
  }
  if (!streamKey) {
    throw errors.apiError('stream_key_required', 'Stream key is required');
  }
  logger.info('[User %s] Connecting RTMP channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating target info...', user.id);
  const target = {
    id: nanoid(),
    name: channelName,
    metadata: {
      rtmp_url: rtmpUrl,
      stream_key: streamKey,
    },
  };

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.RTMP, target, null);
  logger.info('[User %s] RTMP channel connected: %s', loadedUser.id, connectedChannel.id);
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
