'use strict';

const userRoutesV1 = require('routes/v1/user');
const channelRoutesV1 = require('routes/v1/channel');
const streamRoutesV1 = require('routes/v1/stream');

const {logger} = require('@forstream/utils');

exports.configure = (express, app) => {
  logger.info('Configuring routes');
  userRoutesV1(express, app);
  channelRoutesV1(express, app);
  streamRoutesV1(express, app);
};
