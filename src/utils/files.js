'use strict';

const configs = require('configs');
const constants = require('utils/constants');
const Promise = require('bluebird');
const awsSdk = require('aws-sdk');
const fs = Promise.promisifyAll(require('fs'));
const mkdirp = require('mkdirp');
const rimraf = Promise.promisify(require('rimraf'));
const path = require('path');
const sharp = require('sharp');
const axios = require('axios');
const {v4: uuid} = require('uuid');

const USER_IMAGE_DIMENSION = 320;

const s3 = new awsSdk.S3();

async function isImage(file) {
  return file.mimeType.startsWith('image');
}

async function processImage(inputFile, outputFile, options) {
  const transformer = sharp(inputFile);
  if (options) {
    if (options.dimension) {
      transformer.resize(options.dimension);
    }
    if (options.png) {
      transformer.png();
    }
  }
  return transformer.toFile(outputFile);
}

async function uploadFile(sourcePath, file, options, publicMode) {
  const relativePath = path.join(file.relativeDir, file.name);
  const destinyDir = path.join(configs.publicPath, file.relativeDir);
  const destinyPath = path.join(configs.publicPath, relativePath);
  const image = isImage(file);

  await mkdirp(destinyDir);
  if (image) {
    await processImage(sourcePath, destinyPath, options);
    await fs.unlinkAsync(sourcePath);
  } else {
    await fs.renameAsync(sourcePath, destinyPath);
  }

  if (configs.env === constants.environment.PRODUCTION) {
    const cdnUrl = publicMode ? configs.publicCDNUrl : configs.privateCDNUrl;
    const bucket = publicMode ? configs.publicS3Bucket : configs.privateS3Bucket;
    await s3.putObject({
      Bucket: bucket,
      Key: relativePath,
      Body: await fs.readFileAsync(destinyPath),
      ContentType: file.mimeType,
    }).promise();
    await fs.unlinkAsync(destinyPath);
    return `${cdnUrl}/${relativePath}`;
  }

  return `${configs.publicUrl}/${relativePath}`;
}

exports.uploadUserImage = async (user, imagePath) => {
  const file = {
    name: `image_${Date.now()}.png`,
    relativeDir: path.join('users', user.id),
    mimeType: 'image/png',
  };
  const options = {
    png: true,
    dimension: USER_IMAGE_DIMENSION,
  };
  return uploadFile(imagePath, file, options, true);
};

exports.downloadFileFromUrl = async (url) => {
  const filePath = path.join(configs.uploadsPath, uuid());
  const writer = fs.createWriteStream(filePath);
  const response = await axios({url, method: 'GET', responseType: 'stream'});
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
};
