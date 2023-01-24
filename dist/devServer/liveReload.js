/**
 * @remix-run/dev v1.11.1
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var exitHook = require('exit-hook');
var fse = require('fs-extra');
var path = require('path');
var prettyMs = require('pretty-ms');
var WebSocket = require('ws');
var channel = require('../channel.js');
require('esbuild');
require('module');
require('@esbuild-plugins/node-modules-polyfill');
require('postcss');
require('postcss-discard-duplicates');
require('cacache');
require('fs');
require('remark-mdx-frontmatter');
require('tsconfig-paths');
require('crypto');
require('postcss-modules');
require('../compiler/plugins/cssSideEffectImportsPlugin.js');
require('@vanilla-extract/integration');
require('jsesc');
var watch = require('../compiler/watch.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var exitHook__default = /*#__PURE__*/_interopDefaultLegacy(exitHook);
var fse__default = /*#__PURE__*/_interopDefaultLegacy(fse);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var prettyMs__default = /*#__PURE__*/_interopDefaultLegacy(prettyMs);
var WebSocket__default = /*#__PURE__*/_interopDefaultLegacy(WebSocket);

const relativePath = file => path__default["default"].relative(process.cwd(), file);
async function liveReload(config, options = {}) {
  let wss = new WebSocket__default["default"].Server({
    port: config.devServerPort
  });
  function broadcast(event) {
    setTimeout(() => {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket__default["default"].OPEN) {
          client.send(JSON.stringify(event));
        }
      });
    }, config.devServerBroadcastDelay);
  }
  function log(message) {
    let _message = `💿 ${message}`;
    console.log(_message);
    broadcast({
      type: "LOG",
      message: _message
    });
  }
  let dispose = await watch.watch(config, {
    mode: options.mode,
    onInitialBuild: options.onInitialBuild,
    onRebuildStart() {
      log("Rebuilding...");
    },
    onRebuildFinish(durationMs) {
      log(`Rebuilt in ${prettyMs__default["default"](durationMs)}`);
      broadcast({
        type: "RELOAD"
      });
    },
    onFileCreated(file) {
      log(`File created: ${relativePath(file)}`);
    },
    onFileChanged(file) {
      log(`File changed: ${relativePath(file)}`);
    },
    onFileDeleted(file) {
      log(`File deleted: ${relativePath(file)}`);
    }
  });
  let channel$1 = channel.createChannel();
  exitHook__default["default"](async () => {
    // cleanup when process exits e.g. user hits CTRL-C
    wss.close();
    await dispose();
    fse__default["default"].emptyDirSync(config.assetsBuildDirectory);
    fse__default["default"].rmSync(config.serverBuildPath);
    channel$1.write();
  });
  return channel$1.read();
}

exports.liveReload = liveReload;
