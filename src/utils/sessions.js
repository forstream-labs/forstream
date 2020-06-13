'use strict';

const configs = require('configs');
const redis = require('apis/redis');
const {errors, logger} = require('@forstream/utils');
const {User} = require('@forstream/models').models;
const Promise = require('bluebird');
const JwtRedis = require('jsonwebtoken-redis');

const jwtRedis = new JwtRedis(redis, {
  prefix: configs.session.prefix,
  expiresKeyIn: configs.session.expiresIn,
  promiseImpl: Promise,
});

exports.createToken = async (user) => {
  try {
    return await jwtRedis.sign({id: user.id}, configs.session.secret, {keyid: configs.session.keyId});
  } catch (err) {
    if (err instanceof JwtRedis.TokenExpiredError) {
      throw errors.authorizationError('token_expired', 'Token expired');
    }
    throw err;
  }
};

exports.decodeToken = async (token) => {
  try {
    if (!token) {
      return null;
    }
    const decoded = await jwtRedis.decode(token, {complete: true});
    if (decoded.header.kid !== configs.session.keyId) {
      return null;
    }
    const payload = await jwtRedis.verify(token, configs.session.secret);
    return new User({id: payload.id});
  } catch (err) {
    if (err instanceof JwtRedis.TokenExpiredError) {
      throw errors.authorizationError('token_expired', 'Token expired');
    }
    logger.warn('Could not decode jwt token', err);
    return null;
  }
};

exports.touchToken = async (token) => {
  if (token) {
    await jwtRedis.touch(token);
  }
};

exports.destroyToken = async (token) => {
  if (token) {
    await jwtRedis.destroy(token);
  }
};
