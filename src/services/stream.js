'use strict';

const youtubeSP = require('services/stream-providers/youtube');
const facebookSP = require('services/stream-providers/facebook');
const {ConnectedChannel, LiveStream, User} = require('models');
const constants = require('utils/constants');
const errors = require('utils/errors');
const logger = require('utils/logger');
const queries = require('utils/queries');
const _ = require('lodash');

const PROVIDER_BY_CHANNEL = {};
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.YOUTUBE}`] = youtubeSP;
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.FACEBOOK}`] = facebookSP;

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

exports.getLiveStream = async (id, options) => queries.get(LiveStream, id, options);

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
