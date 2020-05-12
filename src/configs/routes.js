'use strict';

const userRoutes = require('routes/user');
const channelRoutes = require('routes/channel');
const streamRoutes = require('routes/stream');

const logger = require('utils/logger');

exports.configure = (express, app) => {
  logger.info('Configuring routes');
  userRoutes(express, app);
  channelRoutes(express, app);
  streamRoutes(express, app);
};
