'use strict';

const google = require('apis/google');

const youtubeApi = google.api.youtube;

exports.getOauth2 = (connectedChannel) => google.getOauth2WithTokens(connectedChannel.config.oauth2);

exports.getTargetId = async (auth) => {
  const channels = await youtubeApi.channels.list({
    auth,
    part: 'id',
    mine: true,
  });
  return channels.data.items[0].id;
};

exports.createBroadcast = async (auth, title, description, startDate) => {
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
};

exports.createStream = async (auth, title) => {
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
    stream_name: cdn.ingestionInfo.streamName,
    ingestion_address: cdn.ingestionInfo.ingestionAddress,
  };
};

exports.bindBroadcast = async (auth, broadcast, stream) => {
  await youtubeApi.liveBroadcasts.bind({
    auth,
    id: broadcast.id,
    streamId: stream.id,
    part: 'id,snippet,contentDetails,status',
  });
};

exports.startLive = async (auth, broadcast) => {
  const liveBroadcast = await youtubeApi.liveBroadcasts.transition({
    auth,
    id: broadcast.id,
    broadcastStatus: 'live',
    part: 'id,snippet,contentDetails,status',
  });
  return {id: liveBroadcast.data.id};
};

exports.stopLive = async () => {

};
