'use strict';

require('app-module-path/register');

const configs = require('configs');
const routes = require('configs/routes');
const logger = require('utils/logger');
const bearerToken = require('express-bearer-token');
const bodyParser = require('body-parser');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');

require('json.date-extensions');

// Parse string to date when call JSON.parse
JSON.useDateParser();

const app = express();

app.set('env', configs.env);
app.set('port', configs.port);

app.use(cors());
app.use('/public', express.static(configs.publicPath));
app.use(morgan('tiny', {stream: {write: (message) => logger.console.debug(message)}}));
app.use(bodyParser.json({
  verify(req, res, buf) {
    req.rawBody = buf;
  },
}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(compression());
app.use(bearerToken({
  queryKey: 'off',
  bodyKey: 'off',
}));

logger.info(`Using ${configs.env} environment settings`);
logger.info(`Debug mode is ${configs.debug ? 'ON' : 'OFF'}`);

routes.configure(express, app);

app.listen(app.get('port'), () => {
  logger.info(`Forstream Backend server is listening on port ${app.get('port')}`);
});
