'use strict';

const configs = require('configs');
const googleApi = require('apis/google');
const facebookApi = require('apis/facebook');
const youtubeSP = require('services/stream-providers/youtube');
const facebookSP = require('services/stream-providers/facebook');
const {Channel, ConnectedChannel, LiveStream, User} = require('models');
const constants = require('utils/constants');
const logger = require('utils/logger');
const queries = require('utils/queries');
const {addSeconds} = require('date-fns');
const pubSub = require('pubsub-js');

pubSub.subscribe('token_refreshed', async (msg, data) => {
  const connectedChannel = await queries.get(ConnectedChannel, data.connected_channel.id, {populate: 'channel'});
  logger.info('[ConnectedChannel %s] Updating access token...', connectedChannel.id);
  if (connectedChannel.channel.identifier === constants.channel.identifier.YOUTUBE) {
    connectedChannel.oauth2.set({
      access_token: data.tokens.access_token,
      expiry_date: new Date(data.tokens.expiry_date),
    });
  }
  await connectedChannel.save();
  logger.info('[ConnectedChannel %s] Access token updated!', connectedChannel.id);
});

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
  connectedChannel.set({oauth2, target_id: targetId});
  return connectedChannel.save();
}

exports.listChannels = async (options) => queries.list(Channel, null, options);

exports.listConnectedChannels = async (user, options) => queries.list(ConnectedChannel, {user: user.id}, options);

exports.connectYouTubeChannel = async (user, authCode) => {
  logger.info('[User %s] Connecting YouTube channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating oauth2 config...', user.id);
  const oauth2 = await googleApi.getOauth2(authCode);
  const oauth2Config = {
    access_token: oauth2.credentials.access_token,
    refresh_token: oauth2.credentials.refresh_token,
    expiry_date: new Date(oauth2.credentials.expiry_date),
  };

  logger.info('[User %s] Getting target id...', user.id);
  const targetId = await youtubeSP.getTargetId(oauth2);

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.YOUTUBE, targetId, oauth2Config);
  logger.info('[User %s] YouTube channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.connectFacebookChannel = async (user, accessToken) => {
  logger.info('[User %s] Connecting Facebook channel...', user.id);
  const loadedUser = await queries.get(User, user.id);

  logger.info('[User %s] Generating oauth2 config...', user.id);
  const longLivedAccessToken = await facebookApi.getLongLivedAccessToken(accessToken);
  const oauth2Config = {
    access_token: longLivedAccessToken.access_token,
    expiry_date: addSeconds(new Date(), longLivedAccessToken.expires_in),
  };

  logger.info('[User %s] Getting target id...', user.id);
  const targetId = await facebookSP.getTargetId(oauth2Config.access_token);

  const connectedChannel = await connectChannel(loadedUser, constants.channel.identifier.FACEBOOK, targetId, oauth2Config);
  logger.info('[User %s] Facebook channel %s connected!', loadedUser.id, connectedChannel.id);
  return connectedChannel;
};

exports.disconnectChannel = async (user, channel) => {
  const loadedChannel = await queries.find(Channel, {identifier: channel});
  const connectedChannel = await queries.find(ConnectedChannel, {user: user.id, channel: loadedChannel.id});
  const liveStreams = await queries.list(LiveStream, {'providers.connected_channel': connectedChannel.id});
  liveStreams.forEach(async (liveStream) => {
    const providerStream = liveStream.providers.find((provider) => provider.connected_channel.toString() === connectedChannel.id);
    if (providerStream.stream_status === constants.streamStatus.COMPLETE) {
      providerStream.set({connected_channel: null});
    } else {
      providerStream.remove();
    }
    await liveStream.save();
  });
  await connectedChannel.remove();
};

exports.getConnectedChannel = async (id, options) => queries.get(ConnectedChannel, id, options);

setupChannels();
