'use strict';

const configs = require('configs');
const axios = require('axios');
const Promise = require('bluebird');

const apiClient = axios.create({
  baseURL: configs.rtmpApiUrl,
});

exports.relayPush = async (liveStream) => {
  const requests = liveStream.providers.map((providerStream) => {
    if (!providerStream.stream_url) {
      return null;
    }
    const params = new URLSearchParams();
    params.append('app', 'live');
    params.append('name', liveStream.stream_key);
    params.append('url', providerStream.stream_url);
    return apiClient.post('/relay/push', params);
  })
  return Promise.all(requests);
};
