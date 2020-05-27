'use strict';

const mongoose = require('mongoose');

const {Schema} = mongoose;

const User = new Schema({
  first_name: {type: String, trim: true, required: true},
  last_name: {type: String, trim: true, required: true},
  email: {type: String, trim: true, required: true, unique: true},
  image_url: {type: String},
  google_id: {type: String},
  facebook_id: {type: String},
  registration_date: {type: Date, required: true},
}, {collection: 'users'});
// eslint-disable-next-line func-names
User.virtual('full_name').get(function () {
  return `${this.first_name} ${this.last_name}`;
});

exports.User = User;
