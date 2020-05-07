'use strict';

const userRoutes = require('routes/user');

const logger = require('utils/logger');

exports.configure = (express, app) => {
  logger.info('Configuring routes');
  userRoutes(express, app);
};
