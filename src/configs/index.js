'use strict';

const constants = require('utils/constants');
const path = require('path');
const yaml = require('yamljs');
const mkdirp = require('mkdirp');
const _ = require('lodash');

const configs = yaml.load(path.resolve('configs.yml'));

function get(property, defaultValue) {
  return _.get(configs, property, defaultValue);
}

function getRequired(property) {
  const value = _.get(configs, property);
  if (!value) {
    throw new Error(`Property "${property}" is required`);
  }
  return value;
}

exports.env = get('app.env', constants.environment.DEVELOPMENT);
exports.port = get('app.port', 3000);
exports.debug = get('app.debug', false);
exports.domain = 'forstream.io';

const serverHost = this.env === constants.environment.DEVELOPMENT ? getRequired('app.host') : null;
exports.serverUrl = this.env === constants.environment.PRODUCTION ? `https://api.${this.domain}` : `http://${serverHost}:${this.port}`;

const liveHost = this.env === constants.environment.PRODUCTION ? getRequired('live.host') : get('live.host', serverHost);
exports.liveApiUrl = `http://${liveHost}:${get('live.api.port', 5000)}/api`;
exports.liveRtmpUrl = this.env === constants.environment.PRODUCTION ? `rtmp://rtmp.${this.domain}/live` : `rtmp://${liveHost}/live`;

exports.assetsUrl = `${this.serverUrl}/assets`;
exports.assetsPath = get('app.assetsPath', path.resolve('assets'));

exports.publicUrl = `${this.serverUrl}/public`;
exports.publicPath = get('app.publicPath', path.resolve('public'));

exports.uploadsUrl = `${this.serverUrl}/uploads`;
exports.uploadsPath = path.join(this.publicPath, 'uploads');

exports.publicS3Bucket = 'forstream-public';
exports.publicCDNUrl = `https://cdn.${this.domain}`;

exports.privateS3Bucket = 'forstream-private';
exports.privateCDNUrl = `https://cdn-private.${this.domain}`;

exports.session = {
  prefix: 'session:',
  keyId: getRequired('session.keyId'),
  secret: getRequired('session.secret'),
  expiresIn: get('session.expiresIn', '24 hours'),
};

exports.mongo = {
  host: get('mongo.host', 'localhost'),
  port: get('mongo.port', 27017),
  schema: get('mongo.schema', 'forstream'),
  options: get('mongo.options', ''),
  cert: get('mongo.cert'),
  username: get('mongo.username'),
  password: get('mongo.password'),
  debug: get('mongo.debug', false),
};

exports.redis = {
  host: get('redis.host', 'localhost'),
  port: get('redis.port', 6379),
  password: get('redis.password'),
};

exports.google = {
  serverKey: getRequired('google.serverKey'),
  oauth2: {
    clientId: getRequired('google.oauth2.clientId'),
    clientSecret: getRequired('google.oauth2.clientSecret'),
  },
};

exports.facebook = {
  appId: getRequired('facebook.appId'),
  appSecret: getRequired('facebook.appSecret'),
};

exports.twitch = {
  clientId: getRequired('twitch.clientId'),
  clientSecret: getRequired('twitch.clientSecret'),
};

exports.aws = {
  keyId: get('aws.keyId'),
  secret: get('aws.secret'),
};

mkdirp.sync(this.publicPath);
mkdirp.sync(this.uploadsPath);

if (this.env === constants.environment.PRODUCTION) {
  if (!this.aws.keyId) {
    throw new Error('Property aws.keyId is required');
  }
  if (!this.aws.secret) {
    throw new Error('Property aws.secret is required');
  }
  process.env.AWS_ACCESS_KEY_ID = this.aws.keyId;
  process.env.AWS_SECRET_ACCESS_KEY = this.aws.secret;
}
