'use strict';

const constants = require('utils/constants');
const mongoose = require('mongoose');
const _ = require('lodash');

const {Schema} = mongoose;
const {ObjectId} = Schema.Types;

const ProviderMessage = new Schema({
  type: {type: String, required: true},
  code: {type: String, required: true},
  message: {type: String, required: true},
}, {_id: false});

const ProviderStream = new Schema({
  connected_channel: {type: ObjectId, ref: 'ConnectedChannel', required: true, index: true},
  enabled: {type: Boolean, required: true},
  broadcast_id: {type: String},
  stream_url: {type: String},
  stream_status: {type: String, enum: _.values(constants.streamStatus), required: true},
  messages: [ProviderMessage],
}, {_id: false});

const LiveStream = new Schema({
  user: {type: ObjectId, ref: 'User', required: true, index: true},
  title: {type: String, required: true},
  description: {type: String, required: true},
  status: {type: String, enum: _.values(constants.streamStatus), required: true},
  providers: {type: [ProviderStream], required: true},
  start_date: {type: Date, required: true},
  end_date: {type: Date},
  registration_date: {type: Date, required: true},
}, {collection: 'live_streams'});

exports.LiveStream = LiveStream;
