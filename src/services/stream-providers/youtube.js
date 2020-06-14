'use strict';

const googleApi = require('apis/google');
const {constants} = require('@forstream/models');
const {logger} = require('@forstream/utils');
const _ = require('lodash');

const youtubeApi = googleApi.youtube;

async function createBroadcast(auth, title, description, startDate) {
  const broadcast = await youtubeApi.liveBroadcasts.insert({
    auth,
    part: 'id,snippet,contentDetails,status',
    resource: {
      contentDetails: {
        enableAutoStart: true,
        monitorStream: {
          enableMonitorStream: false,
        },
      },
      snippet: {
        title,
        description,
        scheduledStartTime: startDate,
      },
      status: {
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
      },
    },
  });
  return {id: broadcast.data.id};
}

async function createStream(auth, title) {
  const stream = await youtubeApi.liveStreams.insert({
    auth,
    part: 'id,snippet,cdn,contentDetails,status',
    resource: {
      snippet: {
        title,
      },
      cdn: {
        frameRate: 'variable',
        ingestionType: 'rtmp',
        resolution: 'variable',
      },
    },
  });
  const {id, cdn} = stream.data;
  return {
    id,
    url: `${cdn.ingestionInfo.ingestionAddress}/${cdn.ingestionInfo.streamName}`,
  };
}

async function bindBroadcast(auth, broadcast, stream) {
  await youtubeApi.liveBroadcasts.bind({
    auth,
    id: broadcast.id,
    streamId: stream.id,
    part: 'id,snippet,contentDetails,status',
  });
}

exports.createLiveStream = async (connectedChannel, title, description, startDate) => {
  try {
    const auth = googleApi.getOauth2FromConnectedChannel(connectedChannel);
    logger.info('[User %s] [Provider %s] Creating broadcast...', connectedChannel.user, connectedChannel.channel.identifier);
    const broadcast = await createBroadcast(auth, title, description, startDate);
    logger.info('[User %s] [Provider %s] Creating stream...', connectedChannel.user, connectedChannel.channel.identifier);
    const stream = await createStream(auth, title);
    logger.info('[User %s] [Provider %s] Binding broadcast to stream...', connectedChannel.user, connectedChannel.channel.identifier);
    await bindBroadcast(auth, broadcast, stream);
    return {
      broadcast_id: broadcast.id,
      stream_url: stream.url,
      stream_status: constants.streamStatus.READY,
    };
  } catch (err) {
    let messages = [];
    if (err.errors) {
      const {errors} = err;
      messages = errors.map((error) => {
        return {
          type: constants.providerMessage.type.ERROR,
          code: error.reason,
          message: error.message,
        };
      });
    } else if (err.response.data.error) {
      const {data} = err.response;
      messages = [{
        type: constants.providerMessage.type.ERROR,
        code: data.error,
        message: data.error_description,
      }];
    } else {
      messages = [{
        type: constants.providerMessage.type.ERROR,
        code: 'unknown_error',
      }];
    }
    return {
      messages,
      broadcast_id: null,
      stream_url: null,
      stream_status: constants.streamStatus.ERROR,
    };
  }
};

exports.startLiveStream = async (providerStream) => {
  providerStream.set({stream_status: constants.streamStatus.LIVE, messages: []});
};

exports.endLiveStream = async (providerStream) => {
  try {
    const auth = googleApi.getOauth2FromConnectedChannel(providerStream.connected_channel);
    await youtubeApi.liveBroadcasts.transition({
      auth,
      id: providerStream.broadcast_id,
      broadcastStatus: 'complete',
      part: 'id,snippet,contentDetails,status',
    });
    providerStream.set({stream_status: constants.streamStatus.COMPLETE});
  } catch (err) {
    // Nothing to do...
  }
};

exports.isActiveLiveStream = async (providerStream) => {
  try {
    const auth = googleApi.getOauth2FromConnectedChannel(providerStream.connected_channel);
    const broadcasts = await youtubeApi.liveBroadcasts.list({
      auth,
      part: 'id,snippet,contentDetails,status',
      id: providerStream.broadcast_id,
    });
    if (_.isEmpty(broadcasts.data.items)) {
      return false;
    }
    const invalidStatuses = ['complete', 'revoked'];
    return !invalidStatuses.includes(broadcasts.data.items[0].status);
  } catch (err) {
    return false;
  }
};
