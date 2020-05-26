FROM keymetrics/pm2:12-alpine

WORKDIR /usr/src/forstream

COPY src src/
COPY package.json .
COPY ecosystem.config.js .

ENV NPM_CONFIG_LOGLEVEL warn

RUN \
  apk add --update --no-cache --virtual .build-deps make gcc g++ python && \
  apk add --update --no-cache vips-dev fftw-dev build-base \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.10/main \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.10/community && \
  npm install --production && \
  apk del .build-deps && \
  touch configs.yml

EXPOSE 3000

CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]
