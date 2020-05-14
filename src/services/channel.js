'use strict';

const configs = require('configs');
const googleApi = require('apis/google');
const youtubeSP = require('services/stream-providers/youtube');
const facebookSP = require('services/stream-providers/facebook');
const {Channel, ConnectedChannel, User} = require('models');
const constants = require('utils/constants');
const logger = require('utils/logger');
const queries = require('utils/queries');

function setupChannels() {
  setTimeout(async () => {
    const youtubeChannel = await queries.find(Channel, {identifier: constants.channel.identifier.YOUTUBE}, {require: false});
    if (!youtubeChannel) {
      await new Channel({
        name: 'YouTube',
        identifier: constants.channel.identifier.YOUTUBE,
        image_url: `${configs.publicUrl}/channels/youtube.png`,
        registration_date: new Date(),
      }).save();
    }
    const facebookChannel = await queries.find(Channel, {identifier: constants.channel.identifier.FACEBOOK}, {require: false});
    if (!facebookChannel) {
      await new Channel({
        name: 'Facebook',
        identifier: constants.channel.identifier.FACEBOOK,
        image_url: `${configs.publicUrl}/channels/facebook.png`,
        registration_date: new Date(),
      }).save();
    }
  }, 5000);
}

async function connectChannel(user, identifier, targetId, oauth2) {
  const channel = await queries.find(Channel, {identifier});
  let connectedChannel = await queries.find(ConnectedChannel, {user: user.id, channel: channel.id}, {require: false});
  if (!connectedChannel) {
    connectedChannel = new ConnectedChannel({
      user,
      channel,
      registration_date: new Date(),
    });
  }
  connectedChannel.set({
    target_id: targetId,
    oauth2,
  });
  return connectedChannel.save();
}

exports.listChannels = async (options) => queries.list(Channel, null, options);

exports.listConnectedChannels = async (user, options) => queries.list(ConnectedChannel, {user: user.id}, options);

exports.connectYouTubeChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting YouTube channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting target id...', user.id);
  const oauth2 = await googleApi.getOauth2(authCode);
  const targetId = await youtubeSP.getTargetId(oauth2);

  const oauth2Config = {access_token: oauth2.credentials.access_token, refresh_token: oauth2.credentials.refresh_token};
  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.YOUTUBE, targetId, oauth2Config);
  logger.info('[User %s] YouTube channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectFacebookChannel = async (user, accessToken) => {
  logger.info('[User %s] Connecting Facebook channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Getting target id...', user.id);
  const targetId = await facebookSP.getTargetId(accessToken);

  const oauth2Config = {access_token: accessToken};
  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.FACEBOOK, targetId, oauth2Config);
  logger.info('[User %s] Facebook channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

setupChannels();
