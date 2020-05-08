'use strict';

const configs = require('configs');
const google = require('apis/google');
const youtube = require('services/stream-providers/youtube');
const facebook = require('services/stream-providers/facebook');
const {Channel, ConnectedChannel, LiveStream, User} = require('models');
const constants = require('utils/constants');
const errors = require('utils/errors');
const files = require('utils/files');
const logger = require('utils/logger');
const queries = require('utils/queries');
const _ = require('lodash');

const oauth2Api = google.api.oauth2;

const PROVIDER_BY_CHANNEL = {};
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.YOUTUBE}`] = youtube;
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.FACEBOOK}`] = facebook;

function setupChannels() {
  setTimeout(async () => {
    const youtubeChannel = await queries.find(Channel, {identifier: constants.channel.identifier.YOUTUBE}, {require: false});
    if (!youtubeChannel) {
      await new Channel({
        name: 'YouTube',
        identifier: constants.channel.identifier.YOUTUBE,
        image_url: `${configs.publicUrl}/channels/youtube.png`,
        registration_date: new Date(),
      }).save();
    }
    const facebookChannel = await queries.find(Channel, {identifier: constants.channel.identifier.FACEBOOK}, {require: false});
    if (!facebookChannel) {
      await new Channel({
        name: 'Facebook',
        identifier: constants.channel.identifier.FACEBOOK,
        image_url: `${configs.publicUrl}/channels/youtube.png`,
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
      enabled: true,
      registration_date: new Date(),
    });
  }
  connectedChannel.set({
    target_id: targetId,
    oauth2,
  });
  return connectedChannel.save();
}

async function createProviderStream(user, connectedChannel, title, description, startDate) {
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && connectedChannel.enabled) {
    logger.info('[User %s] [Provider %s] Creating stream..', user.id, channel.identifier);
    const liveStream = await provider.createLiveStream(connectedChannel, title, description, startDate);
    logger.info('[User %s] [Provider %s] Stream created!', user.id, channel.identifier);
    return {
      connected_channel: connectedChannel,
      broadcast_id: liveStream.broadcast_id,
      stream_url: liveStream.stream_url,
      stream_status: constants.streamStatus.READY,
    };
  }
  return null;
}

async function startProviderStream(liveStream, providerStream) {
  const connectedChannel = providerStream.connected_channel;
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && connectedChannel.enabled) {
    logger.info('[LiveStream %s] [Provider %s] Starting live stream...', liveStream.id, channel.identifier);
    await provider.startLiveStream(providerStream);
    providerStream.set({stream_status: constants.streamStatus.LIVE});
    logger.info('[LiveStream %s] [Provider %s] Live stream started!', liveStream.id, channel.identifier);
  }
}

exports.signInWithGoogle = async (authCode) => {
  logger.info('Signing in with Google...');
  const oauth2 = await google.getOauth2(authCode);

  logger.info('Getting Google profile...');
  const userinfo = await oauth2Api.userinfo.get({auth: oauth2});

  logger.info('[GoogleId %s] Searching for a user with email %s...', userinfo.data.id, userinfo.data.email);
  let user = await queries.find(User, {email: userinfo.data.email}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', userinfo.data.id, user.id);
    user.set({google_id: userinfo.data.id});
    return user.save();
  }

  logger.info('[GoogleId %s] No users found, searching by google_id...', userinfo.data.id);
  user = await queries.find(User, {google_id: userinfo.data.id}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', userinfo.data.id, user.id);
    return user;
  }

  logger.info('[GoogleId %s] No users found, creating it...', userinfo.data.id);
  user = new User({
    first_name: userinfo.data.given_name,
    last_name: userinfo.data.family_name,
    email: userinfo.data.email,
    google_id: userinfo.data.id,
    registration_date: new Date(),
  });
  const imagePath = await files.downloadFileFromUrl(userinfo.data.picture);
  const imageUrl = await files.uploadUserImage(user, imagePath);
  user.set({image_url: imageUrl});
  await user.save();
  logger.info('[GoogleId %s] User %s created!', userinfo.data.id, user.id);
  return user;
};

exports.connectYouTubeChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting YouTube channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting target id...', user.id);
  const oauth2 = await google.getOauth2(authCode);
  const targetId = await youtube.getTargetId(oauth2);

  const oauth2Config = {access_token: oauth2.credentials.access_token, refresh_token: oauth2.credentials.refresh_token};
  const connectedChannel = connectChannel(loadedUser, constants.channel.identifier.YOUTUBE, targetId, oauth2Config);
  logger.info('[User %s] YouTube channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectFacebookChannel = async (user, accessToken) => {
  logger.info('[User %s] Connecting Facebook channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting target id...', user.id);
  const targetId = await facebook.getTargetId(accessToken);

  const oauth2Config = {access_token: accessToken};
  const connectedChannel = connectChannel(loadedUser, constants.channel.identifier.FACEBOOK, targetId, oauth2Config);
  logger.info('[User %s] Facebook channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.createLiveStream = async (user, title, description) => {
  logger.info('[User %s] Creating live stream...', user.id);
  const loadedUser = await queries.get(User, user.id);
  const connectedChannels = await queries.list(ConnectedChannel, {user: loadedUser.id}, {populate: 'channel'});
  if (_.isEmpty(connectedChannels)) {
    throw errors.apiError('no_channels_connected', 'No channels connected');
  }
  const finalTitle = title || `Live with ${loadedUser.full_name}`;
  const finalDescription = description || 'Live stream provided by livestream.io';
  const startDate = new Date();
  const promises = [];
  connectedChannels.forEach((connectedChannel) => {
    promises.push(createProviderStream(loadedUser, connectedChannel, finalTitle, finalDescription, startDate));
  });
  const providers = await Promise.all(promises);
  const liveStream = new LiveStream({
    owner: loadedUser,
    title: finalTitle,
    description: finalDescription,
    providers: providers.filter((provider) => provider !== null),
    start_date: startDate,
    registration_date: new Date(),
  });
  await liveStream.save();
  logger.info('[User %s] Live stream %s created!', loadedUser.id, liveStream.id);
  return liveStream;
};

exports.startLiveStream = async (liveStream) => {
  logger.info('[LiveStream %s] Starting live stream...', liveStream.id);
  const promises = [];
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id, {
    populate: {
      path: 'providers.connected_channel', populate: 'channel',
    },
  });
  loadedLiveStream.providers.forEach((streamProvider) => {
    promises.push(startProviderStream(liveStream, streamProvider));
  });
  await Promise.all(promises);
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Live stream started!', loadedLiveStream.id);
  return loadedLiveStream;
};

exports.stopLiveStream = async () => {

};

setupChannels();
