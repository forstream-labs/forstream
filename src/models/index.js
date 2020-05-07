'use strict';

const mongo = require('apis/mongo');
const {Channel, ConnectedChannel} = require('models/channel');
const {LiveStream} = require('models/live-stream');
const {User} = require('models/user');
const _ = require('lodash');

const {Schema} = mongo;
const {ObjectId} = Schema.Types;

function isId(value) {
  return _.isString(value) || value instanceof mongo.Types.ObjectId;
}

function transformAttr(schemaAttr, key, value, clone) {
  if (_.isObject(schemaAttr) && schemaAttr.type === ObjectId && schemaAttr.ref) {
    if (isId(value)) {
      // eslint-disable-next-line no-param-reassign
      clone[key] = {id: value};
    } else if (_.isArray(value)) {
      // eslint-disable-next-line no-param-reassign
      clone[key] = value.map((item) => (isId(item) ? {id: item} : item));
    } else {
      // eslint-disable-next-line no-param-reassign
      clone[key] = value;
    }
  }
}

function transform(schema, obj, customTransform) {
  const clone = _.cloneDeep(obj);
  delete clone._id;
  // eslint-disable-next-line no-underscore-dangle
  delete clone.__v;
  if (customTransform) {
    customTransform(clone);
  }
  _.forEach(clone, (value, key) => {
    const schemaAttr = schema.obj[key];
    if (schemaAttr) {
      if (_.isArray(schemaAttr.type)) {
        transformAttr(schemaAttr.type[0], key, value, clone);
      } else {
        transformAttr(schemaAttr, key, value, clone);
      }
    }
  });
  return clone;
}

function normalizeSchema(schema, customTransform) {
  // eslint-disable-next-line func-names
  schema.virtual('id').set(function (id) {
    this.set('_id', id);
  });
  schema.set('toJSON', {
    virtuals: true,
    transform: (doc, obj) => transform(schema, obj, customTransform),
  });
  schema.set('toObject', {
    virtuals: true,
    transform: (doc, obj) => transform(schema, obj, customTransform),
  });
  return schema;
}

exports.Channel = mongo.model('Channel', normalizeSchema(Channel));
exports.ConnectedChannel = mongo.model('ConnectedChannel', normalizeSchema(ConnectedChannel));
exports.LiveStream = mongo.model('LiveStream', normalizeSchema(LiveStream));
exports.User = mongo.model('User', normalizeSchema(User, (user) => {
  // eslint-disable-next-line no-param-reassign
  delete user.youtube_token;
}));
