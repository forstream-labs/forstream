'use strict';

const configs = require('configs');
const util = require('util');

function ApiError(status, code, message, cause) {
  // eslint-disable-next-line no-underscore-dangle
  if (!cause && ApiError.super_.captureStackTrace) {
    // eslint-disable-next-line no-underscore-dangle
    ApiError.super_.captureStackTrace(this, this.constructor);
  } else if (cause) {
    this.stack = cause.stack;
  }
  this.name = this.constructor.name;
  this.status = status;
  this.code = code;
  this.message = message;
  this.causeMessage = cause ? cause.message : null;
  this.json = () => {
    const json = {status: this.status, code: this.code, message: this.message};
    if (configs.debug === true && cause) {
      json.causeMessage = this.causeMessage;
    }
    return json;
  };
  this.toString = () => this.message;
}
util.inherits(ApiError, Error);

exports.apiError = (code, message, cause) => new ApiError(400, code, message, cause);

exports.authenticationError = (cause) => new ApiError(401, 'authentication_required', 'Authentication required', cause);

exports.authorizationError = (code, message, cause) => new ApiError(403, code, message, cause);

exports.permissionDeniedError = (cause) => new ApiError(403, 'permission_denied', 'Permission denied', cause);

exports.notFoundError = (code, message, cause) => new ApiError(404, code, message, cause);

exports.internalError = (message, cause) => new ApiError(500, 'internal_error', message, cause);

exports.respondWithError = (res, err) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.json());
  } else {
    const internal = this.internalError(err.message, err);
    res.status(internal.status).json(internal.json());
  }
};
