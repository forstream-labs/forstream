'use strict';

const {userAuthenticated} = require('routes/middlewares');
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
  const connectedChannel = await channelService.connectFacebookChannel(req.user, req.body.access_token);
  res.json(connectedChannel);
}

module.exports = (express, app) => {
  const router = express.Router({mergeParams: true});

  router.get('', userAuthenticated, helpers.baseCallback(listChannels));

  router.post('/youtube/connect', userAuthenticated, helpers.baseCallback(connectYouTubeChannel));
  router.post('/facebook/connect', userAuthenticated, helpers.baseCallback(connectFacebookChannel));

  app.use('/channels', router);
};
