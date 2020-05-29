'use strict';

const channelService = require('services/channel');
const streamService = require('services/stream');
const errors = require('utils/errors');
const logger = require('utils/logger');
const session = require('utils/session');
const _ = require('lodash');

function getId(req, key) {
  let id = req.params[key] || (req.body[key] ? req.body[key].id : null);
  if (!id && _.isString(req.body.data)) {
    const json = JSON.parse(req.body.data);
    id = json[key] ? json[key].id : null;
  }
  return id;
}

exports.decodeToken = async (req) => {
  if (!req.token) {
    return;
  }
  await session.touchToken(req.token);
  req.user = await session.decodeToken(req.token);
};

exports.userAuthenticated = async (req, res, next) => {
  try {
    await this.decodeToken(req);
    if (!req.user) {
      throw errors.authenticationError();
    }
    logger.debug(`${req.method} ${req.originalUrl} [User: ${req.user.id}]`);
    next();
  } catch (err) {
    logger.error(err);
    errors.respondWithError(res, err);
  }
};

exports.connectedChannelBelongsToUser = async (req, res, next) => {
  try {
    const connectedChannelId = getId(req, 'connected_channel');
    if (!connectedChannelId) {
      throw errors.permissionDeniedError();
    }
    const connectedChannel = await channelService.getConnectedChannel(connectedChannelId);
    if (connectedChannel.user.toString() !== req.user.id) {
      throw errors.permissionDeniedError();
    }
    req.connected_channel = connectedChannel;
    next();
  } catch (err) {
    logger.error(err);
    errors.respondWithError(res, err);
  }
};

exports.liveStreamBelongsToUser = async (req, res, next) => {
  try {
    const liveStreamId = getId(req, 'live_stream');
    if (!liveStreamId) {
      throw errors.permissionDeniedError();
    }
    const liveStream = await streamService.getLiveStream(liveStreamId);
    if (liveStream.user.toString() !== req.user.id) {
      throw errors.permissionDeniedError();
    }
    req.live_stream = liveStream;
    next();
  } catch (err) {
    logger.error(err);
    errors.respondWithError(res, err);
  }
};
