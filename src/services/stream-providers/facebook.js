'use strict';

const facebook = require('apis/facebook');
const logger = require('utils/logger');

exports.getTargetId = async (auth) => {
  const user = await facebook.api('me', {access_token: auth});
  return user.id;
};

exports.createLiveStream = async (connectedChannel, title, description, startDate) => {
  const accessToken = connectedChannel.oauth2.access_token;
  logger.info('[User %s] [Provider %s] Creating broadcast...', connectedChannel.user, connectedChannel.channel.identifier);
  const broadcast = await facebook.api(`${connectedChannel.target_id}/live_videos`, 'POST', {
    title,
    description,
    status: 'UNPUBLISHED',
    access_token: accessToken,
  });
  console.log(broadcast);
  return {
    broadcast_id: broadcast.id,
    stream_url: broadcast.secure_stream_url,
  };
};

exports.startLiveStream = async (liveStream) => {
  const accessToken = liveStream.connected_channel.oauth2.access_token;
  await facebook.api(`/${liveStream.broadcast_id}`, {
    status: 'LIVE_NOW',
    access_token: accessToken,
  });
};

exports.stopLiveStream = async () => {

};
