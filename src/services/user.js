'use strict';

const googleApi = require('apis/google');
const facebookApi = require('apis/facebook');
const files = require('utils/files');
const queries = require('utils/queries');
const {errors, logger} = require('@forstream/utils');
const {User} = require('@forstream/models').models;
const _ = require('lodash');

const oauth2Api = googleApi.oauth2;

const ALLOWED_ATTRS_TO_UPDATE = ['first_name', 'last_name', 'email'];

function validateUser(user) {
  if (!user.first_name || _.isEmpty(user.first_name)) {
    throw errors.apiError('first_name_required', 'First name required');
  }
  if (!user.last_name || _.isEmpty(user.last_name)) {
    throw errors.apiError('last_name_required', 'Last name required');
  }
}

exports.getUser = async (id, options) => queries.get(User, id, options);

exports.updateUser = async (user, data) => {
  const attrs = _.pick(data, ALLOWED_ATTRS_TO_UPDATE);
  const loadedUser = await queries.get(User, user.id);
  loadedUser.set(attrs);
  validateUser(loadedUser);
  return loadedUser.save();
};

exports.updateUserImage = async (user, imagePath) => {
  const loadedUser = await queries.get(User, user.id);
  const imageUrl = await files.uploadUserImage(loadedUser, imagePath);
  loadedUser.image_url = imageUrl;
  return loadedUser.save();
};

exports.signInWithGoogle = async (authCode) => {
  logger.info('Signing in with Google...');

  logger.debug('Getting Google profile data...');
  const oauth2 = await googleApi.getOauth2FromAuthCode(authCode);
  const profile = await oauth2Api.userinfo.get({auth: oauth2});
  logger.debug('[GoogleId %s] Google profile data: %j', profile.data.id, profile.data);

  logger.info('[GoogleId %s] Searching user with google_id...', profile.data.id);
  let user = await queries.find(User, {google_id: profile.data.id}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', profile.data.id, user.id);
    return user;
  }

  if (profile.data.email) {
    logger.info('[GoogleId %s] Searching user with email %s...', profile.data.id, profile.data.email);
    user = await queries.find(User, {email: profile.data.email}, {require: false});
    if (user) {
      logger.info('[GoogleId %s] User %s was found, returning it!', profile.data.id, user.id);
      user.set({google_id: profile.data.id});
      return user.save();
    }
  }

  logger.info('[GoogleId %s] No users found, creating it...', profile.data.id);
  user = new User({
    first_name: profile.data.given_name,
    last_name: profile.data.family_name,
    email: profile.data.email,
    google_id: profile.data.id,
    registration_date: new Date(),
  });
  const imagePath = await files.downloadFileFromUrl(profile.data.picture);
  const imageUrl = await files.uploadUserImage(user, imagePath);
  user.set({image_url: imageUrl});
  await user.save();
  logger.info('[GoogleId %s] User %s created!', profile.data.id, user.id);
  return user;
};

exports.signInWithFacebook = async (accessToken) => {
  logger.info('Signing in with Facebook...');

  logger.debug('Getting Facebook profile data...');
  const options = {access_token: accessToken, fields: 'first_name,last_name,email,picture.width(320)'};
  const profile = await facebookApi.api('me', options);
  logger.debug('[FacebookId %s] Facebook profile data: %j', profile.id, profile);

  logger.info('[FacebookId %s] Searching user by facebook_id...', profile.id);
  let user = await queries.find(User, {facebook_id: profile.id}, {require: false});
  if (user) {
    logger.info('[FacebookId %s] User %s was found, returning it!', profile.id, user.id);
    return user;
  }

  if (profile.email) {
    logger.info('[FacebookId %s] Searching user with email %s...', profile.id, profile.email);
    user = await queries.find(User, {email: profile.email}, {require: false});
    if (user) {
      logger.info('[FacebookId %s] User %s was found, returning it!', profile.id, user.id);
      user.set({facebook_id: profile.id});
      return user.save();
    }
  }

  logger.info('[FacebookId %s] No users found, creating it...', profile.id);
  user = new User({
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    facebook_id: profile.id,
    registration_date: new Date(),
  });
  const imagePath = await files.downloadFileFromUrl(profile.picture.data.url);
  const imageUrl = await files.uploadUserImage(user, imagePath);
  user.set({image_url: imageUrl});
  await user.save();
  logger.info('[FacebookId %s] User %s created!', profile.id, user.id);
  return user;
};
