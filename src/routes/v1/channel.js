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

async function listFacebookChannelTargets(req, res) {
  const channelTargets = await channelService.listFacebookChannelTargets(req.user, req.query.access_token);
  res.json(channelTargets);
}

async function connectFacebookChannel(req, res) {
  const connectedChannel = await channelService.connectFacebookChannel(req.user, req.body.access_token, req.body.target_id);
  res.json(connectedChannel);
}

async function connectTwitchChannel(req, res) {
  const connectedChannel = await channelService.connectTwitchChannel(req.user, req.body.auth_code);
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
  channelsRouter.get('/facebook/targets', userAuthenticated, helpers.baseCallback(listFacebookChannelTargets));
  channelsRouter.post('/facebook/connect', userAuthenticated, helpers.baseCallback(connectFacebookChannel));
  channelsRouter.post('/twitch/connect', userAuthenticated, helpers.baseCallback(connectTwitchChannel));
  channelsRouter.post('/:channel/disconnect', userAuthenticated, helpers.baseCallback(disconnectChannel));
  app.use('/v1/channels', channelsRouter);

  const connectedChannelsRouter = express.Router({mergeParams: true});
  connectedChannelsRouter.get('/:connected_channel', [userAuthenticated, connectedChannelBelongsToUser], helpers.baseCallback(getConnectedChannel));
  app.use('/v1/connected_channels', connectedChannelsRouter);
};
