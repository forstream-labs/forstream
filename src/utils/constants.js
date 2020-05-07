'use strict';

module.exports = Object.freeze({
  environment: Object.freeze({
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
  }),
  channel: Object.freeze({
    identifier: Object.freeze({
      YOUTUBE: 'youtube',
    }),
  }),
  streamProvider: Object.freeze({
    streamStatus: Object.freeze({
      READY: 'ready',
      LIVE: 'live',
      COMPLETE: 'complete',
    }),
  }),
});
