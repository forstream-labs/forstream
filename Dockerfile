FROM keymetrics/pm2:12-alpine

WORKDIR /usr/src/forstream

COPY src src/
COPY public/channels public/channels/
COPY package.json .
COPY ecosystem.config.js .

ENV NPM_CONFIG_LOGLEVEL warn

RUN apk update && apk upgrade && \
    apk add --update --no-cache --update-cache build-base vips-dev fftw-dev \
    --repository https://alpine.global.ssl.fastly.net/alpine/v3.10/main \
    --repository https://alpine.global.ssl.fastly.net/alpine/v3.10/community

RUN npm install --production && touch configs.yml

EXPOSE 3000

CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]
