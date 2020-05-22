'use strict';

const {userAuthenticated} = require('routes/middlewares');
const helpers = require('routes/helpers');
const channelService = require('services/channel');
const streamService = require('services/stream');
const userService = require('services/user');
const session = require('utils/session');

// Users

async function getMyUser(req, res) {
  const user = await userService.getUser(req.user.id, helpers.getOptions(req));
  res.json(user);
}

// Channels

async function listMyConnectedChannels(req, res) {
  const connectedChannels = await channelService.listConnectedChannels(req.user, helpers.getOptions(req));
  res.json(connectedChannels);
}

// Streams

async function listMyLiveStreams(req, res) {
  const liveStreams = await streamService.listLiveStreams(req.user, helpers.getOptions(req));
  res.json(liveStreams);
}

// Sign in and Sign out

async function signInWithGoogle(req, res) {
  const user = await userService.signInWithGoogle(req.body.auth_code);
  const token = await session.createToken(user);
  res.json({token, user});
}

async function signInWithFacebook(req, res) {
  const user = await userService.signInWithFacebook(req.body.access_token);
  const token = await session.createToken(user);
  res.json({token, user});
}

async function signOut(req, res) {
  if (req.token) {
    await session.destroyToken(req.token);
  }
  res.json();
}

module.exports = (express, app) => {
  const router = express.Router({mergeParams: true});

  router.get('/me', userAuthenticated, helpers.baseCallback(getMyUser));
  router.get('/me/channels', userAuthenticated, helpers.baseCallback(listMyConnectedChannels));
  router.get('/me/streams', userAuthenticated, helpers.baseCallback(listMyLiveStreams));

  router.post('/sign_in/google', helpers.baseCallback(signInWithGoogle));
  router.post('/sign_in/facebook', helpers.baseCallback(signInWithFacebook));
  router.post('/sign_out', userAuthenticated, helpers.baseCallback(signOut));

  app.use('/users', router);
};
