'use strict';

const {errors, logger} = require('@forstream/utils');
const _ = require('lodash');

function buildPopulate(populateStr) {
  if (!populateStr) {
    return {};
  }
  const populate = {};
  const populateTrees = [];
  populateStr.split(' ').forEach((populatePath) => {
    const populateTree = {};
    let currentPath = null;
    populatePath.split('.').forEach((field) => {
      currentPath = currentPath ? `${currentPath}.populate[${field}]` : field;
      _.set(populateTree, currentPath, {path: field.replace(/->/g, '.'), select: []});
    });
    populateTrees.push(populateTree);
  });
  _.merge(populate, ...populateTrees);
  return populate;
}

function buildSelect(selectStr, populate) {
  if (!selectStr) {
    return [];
  }
  const select = [];
  selectStr.split(' ').forEach((selectPath) => {
    const separatorIndex = selectPath.lastIndexOf('.');
    if (separatorIndex >= 0) {
      const path = selectPath.substring(0, separatorIndex);
      const selection = selectPath.substring(separatorIndex + 1, selectPath.length);
      let currentPath = null;
      path.split('.').forEach((field) => {
        currentPath = currentPath ? `${currentPath}.populate[${field}]` : field;
      });
      _.get(populate, currentPath).select.push(selection);
    } else {
      select.push(selectPath);
    }
  });
  return select;
}

function fixPopulate(populate) {
  const fixedPopulate = _.toArray(populate);
  fixedPopulate.forEach((currentPopulate) => {
    if (currentPopulate.populate) {
      // eslint-disable-next-line no-param-reassign
      currentPopulate.populate = fixPopulate(currentPopulate.populate);
    }
  });
  return fixedPopulate;
}

function fixSort(sort) {
  if (!sort) {
    return null;
  }
  const fixedSort = {};
  sort.split(' ').forEach((sortStr) => {
    const sortSplit = sortStr.split(':');
    const fieldName = sortSplit[0];
    const fieldSort = sortSplit.length > 1 ? sortSplit[1] : 'asc';
    fixedSort[fieldName] = fieldSort;
  });
  return fixedSort;
}

exports.getOptions = (req) => {
  const populate = buildPopulate(req.query.populate);
  const select = buildSelect(req.query.select, populate);
  const options = {
    select,
    populate: fixPopulate(populate),
    sort: fixSort(req.query.sort),
    last: req.query.last || null,
    skip: req.query.skip ? parseInt(req.query.skip, 10) : null,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : null,
    require: this.toBoolean(req.query.require),
  };
  return options;
};

exports.toBoolean = (value) => {
  if (_.isNil(value)) {
    return false;
  }
  if (_.isString(value)) {
    return value === 'true';
  }
  return Boolean(value);
};

exports.toArray = (value) => {
  if (_.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
};

exports.convertEmptyToNull = (data) => {
  const dataClone = _.cloneDeep(data);
  const keys = Object.keys(dataClone);
  keys.forEach((key) => {
    const value = dataClone[key];
    if (_.isString(value) && value === '') {
      dataClone[key] = null;
    }
    if (_.isObject(value)) {
      dataClone[key] = this.convertEmptyToNull(value);
    }
  });
  return dataClone;
};

exports.baseCallback = (promise) => (req, res) => {
  promise(req, res).then(() => {
    // Nothing to do...
  }).catch((err) => {
    logger.error(err);
    errors.respondWithError(res, err);
  });
};
