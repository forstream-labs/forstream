'use strict';

const configs = require('configs');
const googleApi = require('apis/google');
const facebookApi = require('apis/facebook');
const youtubeSP = require('services/stream-providers/youtube');
const facebookSP = require('services/stream-providers/facebook');
const {Channel, ConnectedChannel, LiveStream, User} = require('models');
const constants = require('utils/constants');
const errors = require('utils/errors');
const files = require('utils/files');
const logger = require('utils/logger');
const queries = require('utils/queries');
const _ = require('lodash');

const oauth2Api = googleApi.oauth2;

const PROVIDER_BY_CHANNEL = {};
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.YOUTUBE}`] = youtubeSP;
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.FACEBOOK}`] = facebookSP;

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
    logger.info('[User %s] [Provider %s] Creating provider stream..', user.id, channel.identifier);
    const provideStream = await provider.createLiveStream(connectedChannel, title, description, startDate);
    logger.info('[User %s] [Provider %s] Provider stream created!', user.id, channel.identifier);
    return {connected_channel: connectedChannel, ...provideStream};
  }
  return null;
}

async function startProviderStream(liveStream, providerStream) {
  const connectedChannel = providerStream.connected_channel;
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && connectedChannel.enabled) {
    if (providerStream.stream_status === constants.streamStatus.READY) {
      logger.info('[LiveStream %s] [Provider %s] Starting provider stream...', liveStream.id, channel.identifier);
      await provider.startLiveStream(providerStream);
      logger.info('[LiveStream %s] [Provider %s] Provider stream started!', liveStream.id, channel.identifier);
    }
  }
}

async function endProviderStream(liveStream, providerStream) {
  const connectedChannel = providerStream.connected_channel;
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && connectedChannel.enabled) {
    if (providerStream.stream_status === constants.streamStatus.LIVE) {
      logger.info('[LiveStream %s] [Provider %s] Ending provider stream...', liveStream.id, channel.identifier);
      await provider.endLiveStream(providerStream);
      logger.info('[LiveStream %s] [Provider %s] Provider stream ended!', liveStream.id, channel.identifier);
    }
  }
}

exports.getUser = async (id, options) => queries.get(User, id, options);

exports.signInWithGoogle = async (authCode) => {
  logger.info('Signing in with Google...');
  const oauth2 = await googleApi.getOauth2(authCode);

  logger.info('Getting Google profile data...');
  const profile = await oauth2Api.userinfo.get({auth: oauth2});
  logger.debug('[GoogleId %s] Google profile data: %j', profile.data.id, profile.data);

  logger.info('[GoogleId %s] Searching for a user with email %s...', profile.data.id, profile.data.email);
  let user = await queries.find(User, {email: profile.data.email}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', profile.data.id, user.id);
    user.set({google_id: profile.data.id});
    return user.save();
  }

  logger.info('[GoogleId %s] No users found, searching by google_id...', profile.data.id);
  user = await queries.find(User, {google_id: profile.data.id}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', profile.data.id, user.id);
    return user;
  }

  logger.info('[GoogleId %s] No users found, creating it...', profile.data.id);
  user = new User({
    first_name: profile.data.given_name,
    last_name: profile.data.family_name,
    email: profile.data.email,
    google_id: profile.data.id,
    registration_date: new Date(),
  });
  const imagePath = await files.downloadFileFromUrl(profile.data.picture);
  const imageUrl = await files.uploadUserImage(user, imagePath);
  user.set({image_url: imageUrl});
  await user.save();
  logger.info('[GoogleId %s] User %s created!', profile.data.id, user.id);
  return user;
};

exports.signInWithFacebook = async (accessToken) => {
  logger.debug('Sign in with Facebook...');

  logger.info('Getting Facebook profile data...');
  const queryOptions = {access_token: accessToken, fields: 'first_name,last_name,email,picture.width(320)'};
  const profile = await facebookApi.api('me', queryOptions);
  logger.debug('[FacebookId %s] Facebook profile data: %j', profile.id, profile);

  logger.info('[FacebookId %s] Searching for a user with email %s...', profile.id, profile.email);
  let user = await queries.find(User, {email: profile.email}, {require: false});
  if (user) {
    logger.info('[FacebookId %s] User %s was found, returning it!', profile.id, user.id);
    user.set({facebook_id: profile.id});
    return user.save();
  }

  logger.info('[FacebookId %s] No users found, searching by facebook_id...', profile.id);
  user = await queries.find(User, {facebook_id: profile.id}, {require: false});
  if (user) {
    logger.info('[FacebookId %s] User %s was found, returning it!', profile.id, user.id);
    return user;
  }

  logger.info('[FacebookId %s] No users found, creating it...', profile.id);
  user = new User({
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    facebook_id: profile.id,
    registration_date: new Date(),
  });
  const imagePath = await files.downloadFileFromUrl(profile.picture.data.url);
  const imageUrl = await files.uploadUserImage(user, imagePath);
  user.set({image_url: imageUrl});
  await user.save();
  logger.info('[FacebookId %s] User %s created!', profile.id, user.id);
  return user;
};

exports.connectYouTubeChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting YouTube channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting target id...', user.id);
  const oauth2 = await googleApi.getOauth2(authCode);
  const targetId = await youtubeSP.getTargetId(oauth2);

  const oauth2Config = {access_token: oauth2.credentials.access_token, refresh_token: oauth2.credentials.refresh_token};
  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.YOUTUBE, targetId, oauth2Config);
  logger.info('[User %s] YouTube channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectFacebookChannel = async (user, accessToken) => {
  logger.info('[User %s] Connecting Facebook channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting target id...', user.id);
  const targetId = await facebookSP.getTargetId(accessToken);

  const oauth2Config = {access_token: accessToken};
  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.FACEBOOK, targetId, oauth2Config);
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
  const finalDescription = description || 'Live stream provided by LiveStream';
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
    status: constants.streamStatus.READY,
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
  if (![constants.streamStatus.READY, constants.streamStatus.ERROR].includes(loadedLiveStream.status)) {
    throw errors.apiError('live_stream_already_started', 'Live stream already started');
  }
  loadedLiveStream.providers.forEach((providerStream) => {
    promises.push(startProviderStream(liveStream, providerStream));
  });
  await Promise.all(promises);
  loadedLiveStream.set({status: constants.streamStatus.LIVE});
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Live stream started!', loadedLiveStream.id);
  return loadedLiveStream;
};

exports.endLiveStream = async (liveStream) => {
  logger.info('[LiveStream %s] Ending live stream...', liveStream.id);
  const promises = [];
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id, {
    populate: {
      path: 'providers.connected_channel', populate: 'channel',
    },
  });
  if (!constants.streamStatus.LIVE) {
    throw errors.apiError('live_stream_not_live', 'Live stream is not live');
  }
  loadedLiveStream.providers.forEach((providerStream) => {
    promises.push(endProviderStream(liveStream, providerStream));
  });
  await Promise.all(promises);
  loadedLiveStream.set({status: constants.streamStatus.COMPLETE});
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Live stream ended!', loadedLiveStream.id);
  return loadedLiveStream;
};

setupChannels();
