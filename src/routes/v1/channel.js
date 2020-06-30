'use strict';

const {connectedChannelBelongsToUser, userAuthenticated} = require('routes/middlewares');
const helpers = require('routes/helpers');
const channelService = require('services/channel');

async function listChannels(req, res) {
  const channels = await channelService.listChannels(helpers.getOptions(req));
  res.json(channels);
}

async function connectYouTubeChannel(req, res) {
  const connectedChannel = await channelService.connectYouTubeChannel(req.user, req.body.auth_code);
  res.json(connectedChannel);
}

async function connectFacebookChannel(req, res) {
  const connectedChannel = await channelService.connectFacebookChannel(req.user, req.body.access_token, req.body.target_id);
  res.json(connectedChannel);
}

async function listFacebookPageChannelTargets(req, res) {
  const channelTargets = await channelService.listFacebookPageChannelTargets(req.user, req.get('access-token'));
  res.json(channelTargets);
}

async function connectFacebookPageChannel(req, res) {
  const connectedChannel = await channelService.connectFacebookPageChannel(req.user, req.body.access_token, req.body.target_id);
  res.json(connectedChannel);
}

async function connectTwitchChannel(req, res) {
  const connectedChannel = await channelService.connectTwitchChannel(req.user, req.body.auth_code);
  res.json(connectedChannel);
}

async function connectRtmpChannel(req, res) {
  const connectedChannel = await channelService.connectRtmpChannel(req.user, req.body.channel_name, req.body.rtmp_url, req.body.stream_key);
  res.json(connectedChannel);
}

async function disconnectChannel(req, res) {
  await channelService.disconnectChannel(req.user, req.params.channel);
  res.json({});
}

async function getConnectedChannel(req, res) {
  const connectedChannel = await channelService.getConnectedChannel(req.params.connected_channel, helpers.getOptions(req));
  res.json(connectedChannel);
}

module.exports = (express, app) => {
  const channelsRouter = express.Router({mergeParams: true});
  channelsRouter.get('', userAuthenticated, helpers.baseCallback(listChannels));
  channelsRouter.post('/youtube/connect', userAuthenticated, helpers.baseCallback(connectYouTubeChannel));
  channelsRouter.post('/facebook/connect', userAuthenticated, helpers.baseCallback(connectFacebookChannel));
  channelsRouter.get('/facebook_page/targets', userAuthenticated, helpers.baseCallback(listFacebookPageChannelTargets));
  channelsRouter.post('/facebook_page/connect', userAuthenticated, helpers.baseCallback(connectFacebookPageChannel));
  channelsRouter.post('/twitch/connect', userAuthenticated, helpers.baseCallback(connectTwitchChannel));
  channelsRouter.post('/rtmp/connect', userAuthenticated, helpers.baseCallback(connectRtmpChannel));
  channelsRouter.post('/:channel/disconnect', userAuthenticated, helpers.baseCallback(disconnectChannel));
  app.use('/v1/channels', channelsRouter);

  const connectedChannelsRouter = express.Router({mergeParams: true});
  connectedChannelsRouter.get('/:connected_channel', [userAuthenticated, connectedChannelBelongsToUser], helpers.baseCallback(getConnectedChannel));
  app.use('/v1/connected_channels', connectedChannelsRouter);
};
