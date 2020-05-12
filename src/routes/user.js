'use strict';

const {decodeToken, userAuthenticated} = require('routes/middlewares');
const helpers = require('routes/helpers');
const userService = require('services/user');
const errors = require('utils/errors');
const session = require('utils/session');

async function getMyUser(req, res) {
  await decodeToken(req);
  if (!req.user) {
    throw errors.apiError('user_not_found', 'User not found');
  }
  const user = await userService.getUser(req.user.id, helpers.getOptions(req));
  res.json(user);
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

  router.get('/me', helpers.baseCallback(getMyUser));

  router.post('/sign_in/google', helpers.baseCallback(signInWithGoogle));
  router.post('/sign_in/facebook', helpers.baseCallback(signInWithFacebook));
  router.post('/sign_out', userAuthenticated, helpers.baseCallback(signOut));

  app.use('/users', router);
};
