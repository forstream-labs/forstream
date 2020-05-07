'use strict';

const mongoose = require('mongoose');

const {Schema} = mongoose;
const {ObjectId} = Schema.Types;

const StreamProvider = new Schema({
  connected_channel: {type: ObjectId, ref: 'ConnectedChannel', required: true, index: true},
  broadcast_id: {type: String, required: true},
  stream_id: {type: String, required: true},
  stream_name: {type: String, required: true},
  stream_status: {type: String, required: true},
  ingestion_address: {type: String, required: true},
}, {_id: false});

const LiveStream = new Schema({
  owner: {type: ObjectId, ref: 'User', required: true, index: true},
  title: {type: String, required: true},
  description: {type: String, required: true},
  stream_providers: {type: [StreamProvider], required: true},
  start_date: {type: Date, required: true},
  registration_date: {type: Date, required: true},
}, {collection: 'live_streams'});

exports.LiveStream = LiveStream;
