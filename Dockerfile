FROM keymetrics/pm2:12-alpine

WORKDIR /usr/src/forstream

ARG NPM_TOKEN
COPY .npmrc .npmrc
COPY src src/
COPY assets assets/
COPY package.json .
COPY ecosystem.config.js .

ENV NPM_CONFIG_LOGLEVEL warn

RUN apk update && apk upgrade && \
    apk add --update --no-cache --update-cache build-base vips-dev fftw-dev \
    --repository https://alpine.global.ssl.fastly.net/alpine/v3.10/main \
    --repository https://alpine.global.ssl.fastly.net/alpine/v3.10/community

RUN npm install --production && rm -f .npmrc

EXPOSE 3000

CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]
