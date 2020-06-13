'use strict';

const configs = require('configs');
const {logger} = require('@forstream/utils');
// eslint-disable-next-line import/no-self-import
const redis = require('redis');

const redisClient = redis.createClient({
  host: configs.redis.host,
  port: configs.redis.port,
  password: configs.redis.password,
});
redisClient.on('connect', () => {
  logger.info('Connection established with Redis');
});
redisClient.on('reconnecting', () => {
  logger.info('Reconnecting to Redis...');
});
redisClient.on('end', () => {
  logger.info('Connection with Redis was lost');
});
redisClient.on('error', (err) => {
  logger.error(err);
});

module.exports = redisClient;
