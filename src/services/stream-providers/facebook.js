'use strict';

const facebookApi = require('apis/facebook');
const {constants} = require('@forstream/models');
const _ = require('lodash');

exports.createLiveStream = async (channel, connectedChannel, title, description) => {
  try {
    const accessToken = connectedChannel.credentials.access_token;
    const broadcast = await facebookApi.api(`${connectedChannel.target.id}/live_videos`, 'POST', {
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
        code: _.snakeCase(error.code),
        message: error.message,
      }],
    };
  }
};

exports.startLiveStream = async (liveStream, providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.LIVE, messages: []});
};

exports.endLiveStream = async (providerStream) => {
  try {
    const connectedChannel = providerStream.connected_channel;
    const accessToken = connectedChannel.credentials.access_token;
    await facebookApi.api(`${providerStream.broadcast_id}`, 'POST', {
      end_live_video: true,
      access_token: accessToken,
    });
    providerStream.set({stream_status: constants.streamStatus.ENDED});
  } catch (err) {
    providerStream.set({stream_status: constants.streamStatus.ENDED});
  }
};

exports.isActiveLiveStream = async (providerStream) => {
  try {
    const connectedChannel = providerStream.connected_channel;
    const accessToken = connectedChannel.credentials.access_token;
    const broadcast = await facebookApi.api(`${providerStream.broadcast_id}`, 'GET', {access_token: accessToken});
    return broadcast && broadcast.status !== 'VOD';
  } catch (err) {
    return false;
  }
};
