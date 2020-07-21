'use strict';

const facebookApi = require('apis/facebook');

const PAGE_LIMIT = 25;

exports.listMessages = async (providerStream, paging) => {
  try {
    const connectedChannel = providerStream.connected_channel;
    const accessToken = connectedChannel.credentials.access_token;
    const result = await facebookApi.api(`${providerStream.broadcast_id}/comments`, 'GET', {
      filter: 'toplevel',
      live_filter: 'no_filter',
      order: 'reverse_chronological',
      limit: PAGE_LIMIT,
      after: paging ? paging.cursors.after : null,
      access_token: accessToken,
    });
    return {messages: result.data, paging: result.data.length === PAGE_LIMIT ? result.paging : null};
  } catch (err) {
    console.log(err);
    throw err;
  }
};
