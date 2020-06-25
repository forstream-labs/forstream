'use strict';

const configs = require('configs');
const liveApi = require('apis/live');
const youtubeSP = require('services/stream-providers/youtube');
const facebookSP = require('services/stream-providers/facebook');
const twitchSP = require('services/stream-providers/twitch');
const queries = require('utils/queries');
const {errors, logger} = require('@forstream/utils');
const {constants} = require('@forstream/models');
const {ConnectedChannel, LiveStream, User} = require('@forstream/models').models;
const _ = require('lodash');
const {nanoid} = require('nanoid');

const PROVIDER_BY_CHANNEL = {};
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.YOUTUBE}`] = youtubeSP;
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.FACEBOOK}`] = facebookSP;
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.TWITCH}`] = twitchSP;

async function createProviderStream(user, connectedChannel, title, description, startDate) {
  const {channel} = connectedChannel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider) {
    logger.info('[User %s] [Provider %s] Creating stream..', user.id, channel.identifier);
    const streamData = await provider.createLiveStream(connectedChannel, title, description, startDate);
    logger.info('[User %s] [Provider %s] Stream created!', user.id, channel.identifier);
    return {
      ...streamData,
      channel,
      connected_channel: connectedChannel,
      enabled: true,
    };
  }
  return null;
}

async function startProviderStream(liveStream, providerStream) {
  const {channel} = providerStream;
  const connectedChannel = providerStream.connected_channel;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && providerStream.enabled) {
    const activeLiveStream = providerStream.stream_status === constants.streamStatus.ERROR || (await provider.isActiveLiveStream(providerStream));
    if (activeLiveStream) {
      if (providerStream.stream_status === constants.streamStatus.READY) {
        logger.info('[LiveStream %s] [Provider %s] Starting stream...', liveStream.id, channel.identifier);
        await provider.startLiveStream(liveStream, providerStream);
        logger.info('[LiveStream %s] [Provider %s] Stream started!', liveStream.id, channel.identifier);
      } else {
        logger.info('[LiveStream %s] [Provider %s] Stream was already started!', liveStream.id, channel.identifier);
      }
    } else {
      logger.info('[LiveStream %s] [Provider %s] Stream is not valid anymore, creating another one...', liveStream.id, channel.identifier);
      const streamData = await provider.createLiveStream(connectedChannel, liveStream.title, liveStream.description, new Date());
      providerStream.set({...streamData});
      if (providerStream.stream_status === constants.streamStatus.READY) {
        logger.info('[LiveStream %s] [Provider %s] Stream created, starting provider stream...', liveStream.id, channel.identifier);
        await provider.startLiveStream(liveStream, providerStream);
        logger.info('[LiveStream %s] [Provider %s] Stream started!', liveStream.id, channel.identifier);
      } else {
        logger.info('[LiveStream %s] [Provider %s] Stream was created with ERRORS and will NOT be started!', liveStream.id, channel.identifier);
      }
    }
  }
}

async function endProviderStream(liveStream, providerStream) {
  const {channel} = providerStream;
  const provider = PROVIDER_BY_CHANNEL[channel.identifier];
  if (provider && providerStream.enabled) {
    if (providerStream.stream_status === constants.streamStatus.LIVE) {
      logger.info('[LiveStream %s] [Provider %s] Ending stream...', liveStream.id, channel.identifier);
      await provider.endLiveStream(providerStream);
      logger.info('[LiveStream %s] [Provider %s] Stream ended!', liveStream.id, channel.identifier);
    } else {
      logger.info('[LiveStream %s] [Provider %s] Stream is NOT live!', liveStream.id, channel.identifier);
    }
  }
}

async function changeLiveStreamProviderState(liveStream, channel, enabled) {
  logger.info('[LiveStream %s] %s provider %s...', liveStream.id, enabled ? 'Enabling' : 'Disabling', channel);
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id, {populate: 'providers.channel providers.connected_channel'});
  if (loadedLiveStream.stream_status === constants.streamStatus.COMPLETE) {
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
}

exports.listLiveStreams = async (user, options) => {
  const finalOptions = options || {};
  if (!finalOptions.sort) {
    finalOptions.sort = {registration_date: 'desc'};
  }
  return queries.list(LiveStream, {user: user.id}, finalOptions);
};

exports.getLiveStream = async (id, options) => queries.get(LiveStream, id, options);

exports.createLiveStream = async (user, title, description, channels) => {
  logger.info('[User %s] Creating live stream...', user.id);
  if (!title) {
    throw errors.apiError('title_required', 'Title is required');
  }
  const loadedUser = await queries.get(User, user.id);
  const connectedChannels = await queries.list(ConnectedChannel, {user: loadedUser.id}, {populate: 'channel'});
  if (_.isEmpty(connectedChannels)) {
    throw errors.apiError('no_channels_connected', 'No channels connected');
  }
  const filteredChannels = connectedChannels.filter((connectedChannel) => channels.includes(connectedChannel.channel.identifier));
  if (_.isEmpty(filteredChannels)) {
    throw errors.apiError('no_connected_channels_enabled', 'No connected channels enabled');
  }
  const promises = [];
  filteredChannels.forEach((connectedChannel) => {
    promises.push(createProviderStream(loadedUser, connectedChannel, title, description, new Date()));
  });
  const providers = await Promise.all(promises);
  const streamKey = nanoid();
  const streamUrl = `${configs.liveRtmpUrl}/${streamKey}`;
  const liveStream = new LiveStream({
    title,
    description,
    user: loadedUser,
    stream_key: streamKey,
    stream_url: streamUrl,
    stream_status: constants.streamStatus.READY,
    providers: providers.filter((provider) => provider !== null),
    registration_date: new Date(),
  });
  await liveStream.save();
  logger.info('[User %s] Live stream %s created!', loadedUser.id, liveStream.id);
  return liveStream;
};

exports.removeLiveStream = async (liveStream) => {
  logger.info('[LiveStream %s] Removing live stream...', liveStream.id);
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id);
  await loadedLiveStream.remove();
  logger.info('[LiveStream %s] Live stream removed!', loadedLiveStream.id);
};

exports.startLiveStream = async (liveStream) => {
  logger.info('[LiveStream %s] Starting live stream...', liveStream.id);
  const promises = [];
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id, {populate: 'providers.channel providers.connected_channel'});
  if (loadedLiveStream.stream_status === constants.streamStatus.COMPLETE) {
    throw errors.apiError('live_stream_already_ended', 'Live stream already ended');
  }
  loadedLiveStream.providers.forEach((providerStream) => promises.push(startProviderStream(loadedLiveStream, providerStream)));
  await Promise.all(promises);
  loadedLiveStream.set({
    stream_status: constants.streamStatus.LIVE,
    start_date: loadedLiveStream.start_date || new Date(),
  });
  await liveApi.relayPush(liveStream);
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Live stream started!', loadedLiveStream.id);
  return loadedLiveStream;
};

exports.endLiveStream = async (liveStream) => {
  logger.info('[LiveStream %s] Ending live stream...', liveStream.id);
  const promises = [];
  const loadedLiveStream = await queries.get(LiveStream, liveStream.id, {populate: 'providers.channel providers.connected_channel'});
  if (loadedLiveStream.stream_status !== constants.streamStatus.LIVE) {
    throw errors.apiError('live_stream_not_live', 'Live stream is not live');
  }
  loadedLiveStream.providers.forEach((providerStream) => promises.push(endProviderStream(loadedLiveStream, providerStream)));
  await Promise.all(promises);
  loadedLiveStream.set({
    stream_status: constants.streamStatus.COMPLETE,
    end_date: new Date(),
  });
  await loadedLiveStream.save();
  logger.info('[LiveStream %s] Live stream ended!', loadedLiveStream.id);
  return loadedLiveStream;
};

exports.enableLiveStreamProvider = async (liveStream, provider) => changeLiveStreamProviderState(liveStream, provider, true);

exports.disableLiveStreamProvider = async (liveStream, provider) => changeLiveStreamProviderState(liveStream, provider, false);
