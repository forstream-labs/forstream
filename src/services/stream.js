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
  if (provider) {
    logger.info('[User %s] [Provider %s] Creating provider stream..', user.id, channel.identifier);
    const provideStream = await provider.createLiveStream(connectedChannel, title, description, startDate);
    logger.info('[User %s] [Provider %s] Provider stream created!', user.id, channel.identifier);
    return {
      ...provideStream,
      connected_channel: connectedChannel,
      enabled: true,
    };
  }
  return null;
}

async function startProviderStream(liveStream, providerStream) {
  const connectedChannel = providerStream.connected_channel;
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && providerStream.enabled) {
    if (providerStream.stream_status === constants.streamStatus.READY) {
      logger.info('[LiveStream %s] [Provider %s] Starting provider stream...', liveStream.id, channel.identifier);
      await provider.startLiveStream(providerStream);
      logger.info('[LiveStream %s] [Provider %s] Provider stream started!', liveStream.id, channel.identifier);
    } else {
      logger.info('[LiveStream %s] [Provider %s] Provider stream is NOT ready!', liveStream.id, channel.identifier);
    }
  }
}

async function endProviderStream(liveStream, providerStream) {
  const connectedChannel = providerStream.connected_channel;
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && providerStream.enabled) {
    if (providerStream.stream_status === constants.streamStatus.LIVE) {
      logger.info('[LiveStream %s] [Provider %s] Ending provider stream...', liveStream.id, channel.identifier);
      await provider.endLiveStream(providerStream);
      logger.info('[LiveStream %s] [Provider %s] Provider stream ended!', liveStream.id, channel.identifier);
    } else {
      logger.info('[LiveStream %s] [Provider %s] Provider stream is NOT live!', liveStream.id, channel.identifier);
    }
  }
}

async function changeLiveStreamProviderState(liveStream, channel, enabled) {
  logger.info('[LiveStream %s] %s provider %s...', liveStream.id, enabled ? 'Enabling' : 'Disabling', channel);
  const promises = [];
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id, {
    populate: {
      path: 'providers.connected_channel', populate: 'channel',
    },
  });
  if (loadedLiveStream.status === constants.streamStatus.COMPLETE) {
    throw errors.apiError('live_stream_already_ended', 'Live stream already ended');
  }
  const providerStream = loadedLiveStream.providers.find((currentProvider) => currentProvider.connected_channel.channel.identifier === channel);
  if (!providerStream) {
    throw errors.apiError('provider_stream_not_found', 'Provider stream not found');
  }
  providerStream.set({enabled});
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Provider %s %s!', loadedLiveStream.id, channel, enabled ? 'enabled' : 'disabled');
  return loadedLiveStream;
};

exports.listLiveStreams = async (user, options) => {
  const finalOptions = options || {};
  if (!finalOptions.sort) {
    finalOptions.sort = {registration_date: 'desc'};
  }
  return queries.list(LiveStream, {user: user.id}, finalOptions);
};

exports.getLiveStream = async (id, options) => queries.get(LiveStream, id, options);

exports.createLiveStream = async (user, title, description, channels) => {
  console.log(channels)

  logger.info('[User %s] Creating live stream...', user.id);
  const loadedUser = await queries.get(User, user.id);
  const connectedChannels = await queries.list(ConnectedChannel, {user: loadedUser.id}, {populate: 'channel'});
  if (_.isEmpty(connectedChannels)) {
    throw errors.apiError('no_channels_connected', 'No channels connected');
  }
  const filteredChannels = connectedChannels.filter((connectedChannel) => {
    return channels.includes(connectedChannel.channel.identifier);
  });
  if (_.isEmpty(filteredChannels)) {
    throw errors.apiError('no_connected_channels_enabled', 'No connected channels enabled');
  }
  const finalTitle = title || `Live with ${loadedUser.full_name}`;
  const finalDescription = description || 'Live stream provided by LiveStream';
  const promises = [];
  filteredChannels.forEach((connectedChannel) => {
    promises.push(createProviderStream(loadedUser, connectedChannel, finalTitle, finalDescription, new Date()));
  });
  const providers = await Promise.all(promises);
  const liveStream = new LiveStream({
    user: loadedUser,
    title: finalTitle,
    description: finalDescription,
    status: constants.streamStatus.READY,
    providers: providers.filter((provider) => provider !== null),
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
  loadedLiveStream.set({
    status: constants.streamStatus.LIVE,
    start_date: new Date(),
  });
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
  loadedLiveStream.set({
    status: constants.streamStatus.COMPLETE,
    end_date: new Date(),
  });
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Live stream ended!', loadedLiveStream.id);
  return loadedLiveStream;
};

exports.enableLiveStreamProvider = async (liveStream, provider) => {
  return changeLiveStreamProviderState(liveStream, provider, true);
};

exports.disableLiveStreamProvider = async (liveStream, provider) => {
  return changeLiveStreamProviderState(liveStream, provider, false);
};
