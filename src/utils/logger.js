'use strict';

const configs = require('configs');
const path = require('path');
const winston = require('winston');

const {format, transports} = winston;
const {colorize, combine, errors, printf, splat, timestamp} = format;

const level = configs.debug ? 'debug' : 'info';

const print = printf((info) => {
  const log = `${info.timestamp} - ${info.level}: ${info.message}`;
  return info.stack ? `${log}\n${info.stack}` : log;
});

const consoleLogger = winston.createLogger({
  level,
  format: combine(
    errors({stack: true}),
    timestamp(),
    colorize(),
    splat(),
    print,
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
});

const fileLogger = winston.createLogger({
  level,
  format: combine(
    errors({stack: true}),
    timestamp(),
    splat(),
    print,
  ),
  transports: [
    new transports.File({
      filename: path.resolve('livestream.log'),
      handleExceptions: true,
    }),
  ],
});

exports.console = consoleLogger;

exports.debug = (...args) => {
  consoleLogger.debug(...args);
  fileLogger.debug(...args);
};

exports.info = (...args) => {
  consoleLogger.info(...args);
  fileLogger.info(...args);
};

exports.warn = (...args) => {
  consoleLogger.warn(...args);
  fileLogger.warn(...args);
};

exports.error = (...args) => {
  consoleLogger.error(...args);
  fileLogger.error(...args);
};
