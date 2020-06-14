'use strict';

const configs = require('configs');
const axios = require('axios');
const Promise = require('bluebird');
const _ = require('lodash');

const liveClient = axios.create({
  baseURL: configs.liveApiUrl,
});

exports.relayPush = async (liveStream) => {
  const requests = _.compact(liveStream.providers.map((providerStream) => {
    if (!providerStream.stream_url) {
      return null;
    }
    const params = new URLSearchParams();
    params.append('app', 'live');
    params.append('name', liveStream.stream_key);
    params.append('url', providerStream.stream_url);
    return liveClient.post('/relay/push', params);
  }));
  await Promise.all(requests);
};
