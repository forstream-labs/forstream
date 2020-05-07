'use strict';

const configs = require('configs');
const logger = require('utils/logger');
const Promise = require('bluebird');
const mongoose = require('mongoose');
const fs = require('fs');

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
if (configs.mongo.username && configs.mongo.password) {
  options.user = configs.mongo.username;
  options.pass = configs.mongo.password;
  options.authSource = 'admin';
}
if (configs.mongo.cert) {
  options.sslValidate = true;
  options.checkServerIdentity = false;
  options.sslCA = [fs.readFileSync(configs.mongo.cert)];
}

mongoose.Promise = Promise;
mongoose.set('debug', configs.mongo.debug);
mongoose.set('useCreateIndex', true);
mongoose.set('bufferCommands', false);
mongoose.connect(`mongodb://${configs.mongo.host}:${configs.mongo.port}/${configs.mongo.schema}?${configs.mongo.options}`, options).catch((err) => {
  logger.error('Could not connect to MongoDB: ', err);
});
mongoose.connection.on('connected', () => {
  logger.info('Connection established with MongoDB (schema %s)', configs.mongo.schema);
});
mongoose.connection.on('disconnected', () => {
  logger.info('Connection with MongoDB was lost');
});

module.exports = mongoose;
