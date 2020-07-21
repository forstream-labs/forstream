'use strict';

const configs = require('configs');
const redis = require('redis');
const facebookCP = require('services/chat-providers/facebook');
const queries = require('utils/queries');
const {constants} = require('@forstream/models');
const {LiveStream} = require('@forstream/models').models;
const {logger} = require('@forstream/commons');

const PROVIDER_BY_CHANNEL = {};
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.FACEBOOK}`] = facebookCP;
PROVIDER_BY_CHANNEL[`${constants.channel.identifier.FACEBOOK_PAGE}`] = facebookCP;

const redisClient = redis.createClient({
  host: configs.redis.host,
  port: configs.redis.port,
  password: configs.redis.password,
});
redisClient.on('connect', () => {
  logger.info('Connection established with Redis (Chat providers)');
});
redisClient.on('reconnecting', () => {
  logger.info('Reconnecting to Redis... (Chat providers)');
});
redisClient.on('end', () => {
  logger.info('Connection with Redis was lost (Chat providers)');
});
redisClient.on('error', (err) => {
  logger.error(err);
});

const tasksByLiveStream = {};
const chatPagingInfo = {};

async function onLiveStreamRecording(liveStream) {
  logger.info('[LiveStream %s] Start listening for chat messages', liveStream.id);
  chatPagingInfo[liveStream.id] = {};
  const task = setInterval(() => {
    liveStream.providers.forEach(async (providerStream) => {
      const {channel} = providerStream;
      const provider = PROVIDER_BY_CHANNEL[channel.identifier];
      if (provider) {
        const currentPage = chatPagingInfo[liveStream.id][channel.identifier];
        const {messages, paging} = await provider.listMessages(providerStream, currentPage);
        chatPagingInfo[liveStream.id][channel.identifier] = paging;
      }
    });
  }, 5000);
  tasksByLiveStream[liveStream.id] = task;
}

async function onLiveStreamStopRecording(liveStream) {
  logger.info('[LiveStream %s] Stop listening for chat messages', liveStream.id);
  clearTimeout(tasksByLiveStream[liveStream.id]);
}

const eventsHandlers = {
  live_stream_recording: (liveStream) => onLiveStreamRecording(liveStream),
  live_stream_stop_recording: (liveStream) => onLiveStreamStopRecording(liveStream),
};

redisClient.on('message', async (event, message) => {
  const data = JSON.parse(message);
  const liveStream = await queries.find(LiveStream, {stream_key: data.stream_key}, {populate: 'providers.channel providers.connected_channel'});
  eventsHandlers[event](liveStream);
});

redisClient.subscribe('live_stream_recording');
redisClient.subscribe('live_stream_stop_recording');
