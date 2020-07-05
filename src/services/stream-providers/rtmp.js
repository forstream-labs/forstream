'use strict';

const {constants} = require('@forstream/models');

exports.createLiveStream = async (connectedChannel) => {
  return {
    broadcast_id: null,
    stream_url: `${connectedChannel.target.metadata.rtmp_url}/${connectedChannel.target.metadata.stream_key}`,
    stream_status: constants.streamStatus.READY,
  };
};

exports.startLiveStream = async (liveStream, providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.LIVE, messages: []});
};

exports.endLiveStream = async (providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.ENDED});
};

exports.isActiveLiveStream = async () => true;
