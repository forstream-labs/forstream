'use strict';

const facebookApi = require('apis/facebook');
const constants = require('utils/constants');
const logger = require('utils/logger');

exports.getTargetId = async (auth) => {
  const user = await facebookApi.api('me', {access_token: auth});
  return user.id;
};

exports.createLiveStream = async (connectedChannel, title, description, startDate) => {
  try {
    const accessToken = connectedChannel.oauth2.access_token;
    logger.info('[User %s] [Provider %s] Creating broadcast...', connectedChannel.user, connectedChannel.channel.identifier);
    const broadcast = await facebookApi.api(`${connectedChannel.target_id}/live_videos`, 'POST', {
      title,
      description,
      status: 'LIVE_NOW',
      access_token: accessToken,
    });
    return {
      broadcast_id: broadcast.id,
      stream_url: broadcast.secure_stream_url,
      stream_status: constants.streamStatus.READY,
    };
  } catch (err) {
    const {error} = err.response;
    return {
      broadcast_id: null,
      stream_url: null,
      stream_status: constants.streamStatus.ERROR,
      messages: [{
        type: constants.providerMessage.type.ERROR,
        code: error.code,
        message: error.message,
      }],
    };
  }
};

exports.startLiveStream = async (providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.LIVE, messages: []});
};

exports.endLiveStream = async (providerStream) => {
  try {
    const accessToken = providerStream.connected_channel.oauth2.access_token;
    await facebookApi.api(`${providerStream.broadcast_id}`, 'POST', {
      end_live_video: true,
      access_token: accessToken,
    });
    providerStream.set({stream_status: constants.streamStatus.COMPLETE});
  } catch (err) {
    // Nothing to do...
  }
};

exports.isActiveLiveStream = async (providerStream) => {
  try {
    const accessToken = providerStream.connected_channel.oauth2.access_token;
    const broadcast = await facebookApi.api(`${providerStream.broadcast_id}`, 'GET', {access_token: accessToken});
    return broadcast && broadcast.status !== 'VOD';
  } catch (err) {
    return false;
  }
};
