/* eslint-disable import/no-extraneous-dependencies, no-template-curly-in-string */

'use strict';

const path = require('path');
const {commands, publish} = require('release-n-publish');

const WORKING_DIR = path.resolve();

async function lintProject() {
  commands.log('Linting project...');
  await commands.exec('npm run lint', WORKING_DIR);
}

// Run this if call directly from command line
if (require.main === module) {
  publish.setWorkingDir(WORKING_DIR);
  publish.setLintTask(lintProject);
  publish.setDockerProject({
    buildArgs: '--build-arg NPM_TOKEN=${NPM_TOKEN}',
    ecr: {
      profile: 'forstream',
      region: 'us-east-1',
      repository: {
        url: '870961355790.dkr.ecr.us-east-1.amazonaws.com',
        namespace: 'forstream',
      },
    },
  });
  publish.run();
}
