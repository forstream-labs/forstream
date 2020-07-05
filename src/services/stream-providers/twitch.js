'use strict';

const twitchApi = require('apis/twitch');
const {constants} = require('@forstream/models');

exports.createLiveStream = async (channel, connectedChannel) => {
  try {
    const twitchClient = twitchApi.getClient(connectedChannel.credentials, connectedChannel);
    const twitchChannel = await twitchClient.kraken.channels.getMyChannel();
    return {
      broadcast_id: null,
      stream_url: `rtmp://live.twitch.tv/app/${twitchChannel.streamKey}`,
      stream_status: constants.streamStatus.READY,
    };
  } catch (err) {
    return {
      broadcast_id: null,
      stream_url: null,
      stream_status: constants.streamStatus.ERROR,
      messages: [{
        type: constants.providerMessage.type.ERROR,
        code: err.message,
        message: err.message,
      }],
    };
  }
};

exports.startLiveStream = async (liveStream, providerStream) => {
  try {
    const connectedChannel = providerStream.connected_channel;
    const twitchClient = twitchApi.getClient(connectedChannel.credentials, connectedChannel);
    const twitchChannel = await twitchClient.kraken.channels.getMyChannel();
    await twitchClient.kraken.channels.updateChannel(twitchChannel, {status: liveStream.title});
    providerStream.set({stream_status: constants.streamStatus.LIVE, messages: []});
  } catch (err) {
    providerStream.set({
      stream_status: constants.streamStatus.ERROR_STARTING,
      messages: [{
        type: constants.providerMessage.type.ERROR,
        code: err.message,
        message: err.message,
      }],
    });
  }
};

exports.endLiveStream = async (providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.ENDED});
};

exports.isActiveLiveStream = async () => true;
