'use strict';

module.exports = {
  apps: [{
    name: 'livestream',
    script: 'src/app.js',
    exec_mode: 'cluster',
    instances: 'max',
    watch: false,
    max_memory_restart: '1G',
  }],
};
