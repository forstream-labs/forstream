'use strict';

const google = require('apis/google');
const logger = require('utils/logger');

const youtubeApi = google.api.youtube;

async function createBroadcast(auth, title, description, startDate) {
  const broadcast = await youtubeApi.liveBroadcasts.insert({
    auth,
    part: 'id,snippet,contentDetails,status',
    resource: {
      contentDetails: {
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
        frameRate: '30fps',
        ingestionType: 'rtmp',
        resolution: '480p',
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

exports.getTargetId = async (auth) => {
  const channels = await youtubeApi.channels.list({
    auth,
    part: 'id',
    mine: true,
  });
  return channels.data.items[0].id;
};

exports.createLiveStream = async (connectedChannel, title, description, startDate) => {
  const auth = google.getOauth2WithTokens(connectedChannel.oauth2);
  logger.info('[User %s] [Provider %s] Creating broadcast...', connectedChannel.user, connectedChannel.channel.identifier);
  const broadcast = await createBroadcast(auth, title, description, startDate);
  logger.info('[User %s] [Provider %s] Creating stream...', connectedChannel.user, connectedChannel.channel.identifier);
  const stream = await createStream(auth, title);
  logger.info('[User %s] [Provider %s] Binding broadcast to stream...', connectedChannel.user, connectedChannel.channel.identifier);
  await bindBroadcast(auth, broadcast, stream);
  return {
    broadcast_id: broadcast.id,
    stream_url: stream.url,
  };
};

exports.startLiveStream = async (liveStream) => {
  const auth = google.getOauth2WithTokens(liveStream.connected_channel.oauth2);
  await youtubeApi.liveBroadcasts.transition({
    auth,
    id: liveStream.broadcast_id,
    broadcastStatus: 'live',
    part: 'id,snippet,contentDetails,status',
  });
};

exports.stopLiveStream = async () => {

};
