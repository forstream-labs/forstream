'use strict';

const {userAuthenticated, liveStreamBelongsToUser} = require('routes/middlewares');
const helpers = require('routes/helpers');
const userService = require('services/user');
const session = require('utils/session');

// Sign in and Sign out

async function signInWithGoogle(req, res) {
  const user = await userService.signInWithGoogle(req.body.auth_code);
  const token = await session.createToken(user);
  res.json({token, user});
}

async function signOut(req, res) {
  if (req.token) {
    await session.destroyToken(req.token);
  }
  res.json();
}

// Channels

async function connectYouTubeChannel(req, res) {
  const connectedChannel = await userService.connectYouTubeChannel(req.user, req.body.auth_code);
  res.json(connectedChannel);
}

async function connectFacebookChannel(req, res) {
  const connectedChannel = await userService.connectFacebookChannel(req.user, req.body.access_token);
  res.json(connectedChannel);
}

// Streams

async function createLiveStream(req, res) {
  const liveStream = await userService.createLiveStream(req.user, req.body.title, req.body.description);
  res.json(liveStream);
}

async function startLiveStream(req, res) {
  const liveStream = await userService.startLiveStream(req.live_stream);
  res.json(liveStream);
}

async function stopLiveStream(req, res) {
  const liveStream = await userService.stopLiveStream(req.live_stream);
  res.json(liveStream);
}

module.exports = (express, app) => {
  const router = express.Router({mergeParams: true});

  router.post('/sign_in/google', helpers.baseCallback(signInWithGoogle));
  router.post('/sign_out', userAuthenticated, helpers.baseCallback(signOut));
  router.post('/channels/youtube', userAuthenticated, helpers.baseCallback(connectYouTubeChannel));
  router.post('/channels/facebook', userAuthenticated, helpers.baseCallback(connectFacebookChannel));
  router.post('/streams', userAuthenticated, helpers.baseCallback(createLiveStream));
  router.post('/streams/:live_stream/start', [userAuthenticated, liveStreamBelongsToUser], helpers.baseCallback(startLiveStream));
  router.post('/streams/:live_stream/stop', [userAuthenticated, liveStreamBelongsToUser], helpers.baseCallback(stopLiveStream));

  app.use('/users', router);
};
