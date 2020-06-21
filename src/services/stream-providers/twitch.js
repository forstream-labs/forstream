'use strict';

const twitchApi = require('apis/twitch');
const {constants} = require('@forstream/models');
const {logger} = require('@forstream/utils');

exports.createLiveStream = async (connectedChannel, title, description) => {
  try {
    const twitchClient = twitchApi.getClient(connectedChannel.oauth2, connectedChannel);
    const channel = await twitchClient.kraken.channels.getMyChannel();
    return {
      broadcast_id: null,
      stream_url: `rtmp://live.twitch.tv/app/${channel.streamKey}`,
      stream_status: constants.streamStatus.READY,
    };
  } catch (err) {
    return {
      broadcast_id: null,
      stream_url: null,
      stream_status: constants.streamStatus.ERROR,
      messages: [{
        type: constants.providerMessage.type.ERROR,
        message: err.message,
      }],
    };
  }
};

exports.startLiveStream = async (liveStream, providerStream) => {
  const twitchClient = twitchApi.getClient(providerStream.connected_channel.oauth2, providerStream.connected_channel);
  const channel = await twitchClient.kraken.channels.getMyChannel();
  await twitchClient.kraken.channels.updateChannel(channel, {status: liveStream.title});
  providerStream.set({stream_status: constants.streamStatus.LIVE, messages: []});
};

exports.endLiveStream = async (providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.COMPLETE});
};

exports.isActiveLiveStream = async (providerStream) => {
  return true;
};
