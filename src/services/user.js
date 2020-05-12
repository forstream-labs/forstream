'use strict';

const googleApi = require('apis/google');
const facebookApi = require('apis/facebook');
const {User} = require('models');
const files = require('utils/files');
const logger = require('utils/logger');
const queries = require('utils/queries');

const oauth2Api = googleApi.oauth2;

exports.getUser = async (id, options) => queries.get(User, id, options);

exports.signInWithGoogle = async (authCode) => {
  logger.info('Signing in with Google...');

  logger.debug('Getting Google profile data...');
  const oauth2 = await googleApi.getOauth2(authCode);
  const profile = await oauth2Api.userinfo.get({auth: oauth2});
  logger.debug('[GoogleId %s] Google profile data: %j', profile.data.id, profile.data);

  logger.info('[GoogleId %s] Searching for a user with email %s...', profile.data.id, profile.data.email);
  let user = await queries.find(User, {email: profile.data.email}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', profile.data.id, user.id);
    user.set({google_id: profile.data.id});
    return user.save();
  }

  logger.info('[GoogleId %s] No users found, searching by google_id...', profile.data.id);
  user = await queries.find(User, {google_id: profile.data.id}, {require: false});
  if (user) {
    logger.info('[GoogleId %s] User %s was found, returning it!', profile.data.id, user.id);
    return user;
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
  logger.info('Sign in with Facebook...');

  logger.debug('Getting Facebook profile data...');
  const options = {access_token: accessToken, fields: 'first_name,last_name,email,picture.width(320)'};
  const profile = await facebookApi.api('me', options);
  logger.debug('[FacebookId %s] Facebook profile data: %j', profile.id, profile);

  logger.info('[FacebookId %s] Searching for a user with email %s...', profile.id, profile.email);
  let user = await queries.find(User, {email: profile.email}, {require: false});
  if (user) {
    logger.info('[FacebookId %s] User %s was found, returning it!', profile.id, user.id);
    user.set({facebook_id: profile.id});
    return user.save();
  }

  logger.info('[FacebookId %s] No users found, searching by facebook_id...', profile.id);
  user = await queries.find(User, {facebook_id: profile.id}, {require: false});
  if (user) {
    logger.info('[FacebookId %s] User %s was found, returning it!', profile.id, user.id);
    return user;
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
