'use strict';

const {liveStreamBelongsToUser, userAuthenticated} = require('routes/middlewares');
const helpers = require('routes/helpers');
const streamService = require('services/stream');

async function createLiveStream(req, res) {
  const liveStream = await streamService.createLiveStream(req.user, req.body.title, req.body.description, req.body.channels);
  res.json(liveStream);
}

async function startLiveStream(req, res) {
  const liveStream = await streamService.startLiveStream(req.live_stream);
  res.json(liveStream);
}

async function endLiveStream(req, res) {
  const liveStream = await streamService.endLiveStream(req.live_stream);
  res.json(liveStream);
}

module.exports = (express, app) => {
  const router = express.Router({mergeParams: true});

  router.post('', userAuthenticated, helpers.baseCallback(createLiveStream));
  router.post('/:live_stream/start', [userAuthenticated, liveStreamBelongsToUser], helpers.baseCallback(startLiveStream));
  router.post('/:live_stream/end', [userAuthenticated, liveStreamBelongsToUser], helpers.baseCallback(endLiveStream));

  app.use('/streams', router);
};
