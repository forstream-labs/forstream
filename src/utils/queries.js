'use strict';

const {errors} = require('@forstream/utils');
const _ = require('lodash');

function throwNotFoundIfNeeded(model, obj, options) {
  if (!obj && options.require) {
    // eslint-disable-next-line new-cap
    const {modelName} = new model().constructor;
    throw errors.notFoundError(`${_.snakeCase(modelName)}_not_found`, `${modelName} not found`);
  }
}

function fillQuery(queryBuilder, options) {
  const queryOptions = options || {};
  if (!_.has(queryOptions, 'require')) {
    queryOptions.require = true;
  }
  if (queryOptions.populate) {
    queryBuilder.populate(queryOptions.populate);
  }
  if (queryOptions.select) {
    queryBuilder.select(queryOptions.select);
  }
  if (queryOptions.sort) {
    queryBuilder.sort(queryOptions.sort);
  }
  if (queryOptions.skip) {
    queryBuilder.skip(queryOptions.skip);
  }
  if (queryOptions.limit) {
    queryBuilder.limit(queryOptions.limit);
  }
  if (queryOptions.last) {
    const desc = queryOptions.sort ? _.find(queryOptions.sort, (order) => order === 'desc' || order === -1) : false;
    if (desc) {
      queryBuilder.where('_id').lt(queryOptions.last);
    } else {
      queryBuilder.where('_id').gt(queryOptions.last);
    }
  }
  if (queryOptions.lean) {
    queryBuilder.lean();
  }
  return queryOptions;
}

exports.get = async (model, id, options) => {
  const queryBuilder = model.findById(id);
  const queryOptions = fillQuery(queryBuilder, options);
  const obj = await queryBuilder.exec();
  throwNotFoundIfNeeded(model, obj, queryOptions);
  return obj;
};

exports.find = async (model, conditions, options) => {
  let queryBuilder;
  if (_.isFunction(conditions)) {
    queryBuilder = model.findOne();
    conditions(queryBuilder);
  } else {
    queryBuilder = model.findOne(conditions);
  }
  const queryOptions = fillQuery(queryBuilder, options);
  const obj = await queryBuilder.exec();
  throwNotFoundIfNeeded(model, obj, queryOptions);
  return obj;
};

exports.list = async (model, conditions, options) => {
  let queryBuilder;
  if (_.isFunction(conditions)) {
    queryBuilder = model.find();
    conditions(queryBuilder);
  } else {
    queryBuilder = model.find(conditions);
  }
  fillQuery(queryBuilder, options);
  return queryBuilder.exec();
};
