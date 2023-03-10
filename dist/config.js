/**
 * @remix-run/dev v1.12.0
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

var node_child_process = require('node:child_process');
var path = require('node:path');
var node_url = require('node:url');
var fse = require('fs-extra');
var getPort = require('get-port');
var NPMCliPackageJson = require('@npmcli/package-json');
var routes = require('./config/routes.js');
var routesConvention = require('./config/routesConvention.js');
var serverModes = require('./config/serverModes.js');
var virtualModules = require('./compiler/virtualModules.js');
var writeConfigDefaults = require('./compiler/utils/tsconfig/write-config-defaults.js');
var flatRoutes = require('./config/flat-routes.js');
var getPreferredPackageManager = require('./cli/getPreferredPackageManager.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fse__default = /*#__PURE__*/_interopDefaultLegacy(fse);
var getPort__default = /*#__PURE__*/_interopDefaultLegacy(getPort);
var NPMCliPackageJson__default = /*#__PURE__*/_interopDefaultLegacy(NPMCliPackageJson);

/**
 * Returns a fully resolved config object from the remix.config.js in the given
 * root directory.
 */
async function readConfig(remixRoot, serverMode = serverModes.ServerMode.Production) {
  var _appConfig$future, _appConfig$future2, _appConfig$future3, _appConfig$future4, _appConfig$future5, _appConfig$future6, _appConfig$future7, _appConfig$future8, _appConfig$future9, _appConfig$future10;
  if (!serverModes.isValidServerMode(serverMode)) {
    throw new Error(`Invalid server mode "${serverMode}"`);
  }
  if (!remixRoot) {
    remixRoot = process.env.REMIX_ROOT || process.cwd();
  }
  let rootDirectory = path__default["default"].resolve(remixRoot);
  let configFile = findConfig(rootDirectory, "remix.config", configExts);
  let appConfig = {};
  if (configFile) {
    let appConfigModule;
    try {
      var _appConfigModule;
      // shout out to next
      // https://github.com/vercel/next.js/blob/b15a976e11bf1dc867c241a4c1734757427d609c/packages/next/server/config.ts#L748-L765
      if (process.env.NODE_ENV === "test") {
        // dynamic import does not currently work inside of vm which
        // jest relies on so we fall back to require for this case
        // https://github.com/nodejs/node/issues/35889
        appConfigModule = require(configFile);
      } else {
        appConfigModule = await import(node_url.pathToFileURL(configFile).href);
      }
      appConfig = ((_appConfigModule = appConfigModule) === null || _appConfigModule === void 0 ? void 0 : _appConfigModule.default) || appConfigModule;
    } catch (error) {
      throw new Error(`Error loading Remix config at ${configFile}\n${String(error)}`);
    }
  }
  let isCloudflareRuntime = ["cloudflare-pages", "cloudflare-workers"].includes(appConfig.serverBuildTarget ?? "");
  let isDenoRuntime = appConfig.serverBuildTarget === "deno";
  let serverBuildPath = resolveServerBuildPath(rootDirectory, appConfig);
  let serverBuildTarget = appConfig.serverBuildTarget;
  let serverBuildTargetEntryModule = `export * from ${JSON.stringify(virtualModules.serverBuildVirtualModule.id)};`;
  let serverConditions = appConfig.serverConditions;
  let serverDependenciesToBundle = appConfig.serverDependenciesToBundle || [];
  let serverEntryPoint = appConfig.server;
  let serverMainFields = appConfig.serverMainFields;
  let serverMinify = appConfig.serverMinify;
  let serverModuleFormat = appConfig.serverModuleFormat || "cjs";
  let serverPlatform = appConfig.serverPlatform || "node";
  if (isCloudflareRuntime) {
    serverConditions ?? (serverConditions = ["worker"]);
    serverDependenciesToBundle = "all";
    serverMainFields ?? (serverMainFields = ["browser", "module", "main"]);
    serverMinify ?? (serverMinify = true);
    serverModuleFormat = "esm";
    serverPlatform = "neutral";
  }
  if (isDenoRuntime) {
    serverConditions ?? (serverConditions = ["deno", "worker"]);
    serverDependenciesToBundle = "all";
    serverMainFields ?? (serverMainFields = ["module", "main"]);
    serverModuleFormat = "esm";
    serverPlatform = "neutral";
  }
  serverMainFields ?? (serverMainFields = serverModuleFormat === "esm" ? ["module", "main"] : ["main", "module"]);
  serverMinify ?? (serverMinify = false);
  let mdx = appConfig.mdx;
  let appDirectory = path__default["default"].resolve(rootDirectory, appConfig.appDirectory || "app");
  let cacheDirectory = path__default["default"].resolve(rootDirectory, appConfig.cacheDirectory || ".cache");
  let defaultsDirectory = path__default["default"].resolve(__dirname, "config", "defaults");
  let userEntryClientFile = findEntry(appDirectory, "entry.client");
  let userEntryServerFile = findEntry(appDirectory, "entry.server");
  let entryServerFile;
  let entryClientFile;
  let pkgJson = await NPMCliPackageJson__default["default"].load(remixRoot);
  let deps = pkgJson.content.dependencies ?? {};
  if (userEntryServerFile) {
    entryServerFile = userEntryServerFile;
  } else {
    if (!deps["isbot"]) {
      console.log(`adding "isbot" to your package.json`);
      pkgJson.update({
        dependencies: {
          ...pkgJson.content.dependencies,
          isbot: "latest"
        }
      });
      await pkgJson.save();
      console.log("adding `isbot` to detect bots, you should commit this change");
      let packageManager = getPreferredPackageManager.getPreferredPackageManager();
      node_child_process.execSync(`${packageManager} install`, {
        cwd: remixRoot,
        stdio: "inherit"
      });
    }
    let serverRuntime = deps["@remix-run/deno"] ? "deno" : deps["@remix-run/cloudflare"] ? "cloudflare" : deps["@remix-run/node"] ? "node" : undefined;
    if (!serverRuntime) {
      let serverRuntimes = ["@remix-run/deno", "@remix-run/cloudflare", "@remix-run/node"];
      let formattedList = listFormat.format(serverRuntimes);
      throw new Error(`Could not determine server runtime. Please install one of the following: ${formattedList}`);
    }
    entryServerFile = `entry.server.${serverRuntime}.tsx`;
  }
  if (userEntryClientFile) {
    entryClientFile = userEntryClientFile;
  } else {
    let clientRuntime = deps["@remix-run/react"] ? "react" : undefined;
    if (!clientRuntime) {
      throw new Error(`Could not determine runtime. Please install the following: @remix-run/react`);
    }
    entryClientFile = `entry.client.${clientRuntime}.tsx`;
  }
  let entryClientFilePath = userEntryClientFile ? path__default["default"].resolve(appDirectory, userEntryClientFile) : path__default["default"].resolve(defaultsDirectory, entryClientFile);
  let entryServerFilePath = userEntryServerFile ? path__default["default"].resolve(appDirectory, userEntryServerFile) : path__default["default"].resolve(defaultsDirectory, entryServerFile);
  let assetsBuildDirectory = appConfig.assetsBuildDirectory || appConfig.browserBuildDirectory || path__default["default"].join("public", "build");
  let absoluteAssetsBuildDirectory = path__default["default"].resolve(rootDirectory, assetsBuildDirectory);
  let devServerPort = Number(process.env.REMIX_DEV_SERVER_WS_PORT) || (await getPort__default["default"]({
    port: Number(appConfig.devServerPort) || 8002
  }));
  // set env variable so un-bundled servers can use it
  process.env.REMIX_DEV_SERVER_WS_PORT = String(devServerPort);
  let devServerBroadcastDelay = appConfig.devServerBroadcastDelay || 0;
  let defaultPublicPath = appConfig.serverBuildTarget === "arc" ? "/_static/build/" : "/build/";
  let publicPath = addTrailingSlash(appConfig.publicPath || defaultPublicPath);
  let rootRouteFile = findEntry(appDirectory, "root");
  if (!rootRouteFile) {
    throw new Error(`Missing "root" route file in ${appDirectory}`);
  }
  let routes$1 = {
    root: {
      path: "",
      id: "root",
      file: rootRouteFile
    }
  };
  let routesConvention$1 = (_appConfig$future = appConfig.future) !== null && _appConfig$future !== void 0 && _appConfig$future.v2_routeConvention ? flatRoutes.flatRoutes : routesConvention.defineConventionalRoutes;
  if (fse__default["default"].existsSync(path__default["default"].resolve(appDirectory, "routes"))) {
    let conventionalRoutes = routesConvention$1(appDirectory, appConfig.ignoredRouteFiles);
    for (let route of Object.values(conventionalRoutes)) {
      routes$1[route.id] = {
        ...route,
        parentId: route.parentId || "root"
      };
    }
  }
  if (appConfig.routes) {
    let manualRoutes = await appConfig.routes(routes.defineRoutes);
    for (let route of Object.values(manualRoutes)) {
      routes$1[route.id] = {
        ...route,
        parentId: route.parentId || "root"
      };
    }
  }
  let watchPaths = [];
  if (typeof appConfig.watchPaths === "function") {
    let directories = await appConfig.watchPaths();
    watchPaths = watchPaths.concat(Array.isArray(directories) ? directories : [directories]);
  } else if (appConfig.watchPaths) {
    watchPaths = watchPaths.concat(Array.isArray(appConfig.watchPaths) ? appConfig.watchPaths : [appConfig.watchPaths]);
  }

  // When tsconfigPath is undefined, the default "tsconfig.json" is not
  // found in the root directory.
  let tsconfigPath;
  let rootTsconfig = path__default["default"].resolve(rootDirectory, "tsconfig.json");
  let rootJsConfig = path__default["default"].resolve(rootDirectory, "jsconfig.json");
  if (fse__default["default"].existsSync(rootTsconfig)) {
    tsconfigPath = rootTsconfig;
  } else if (fse__default["default"].existsSync(rootJsConfig)) {
    tsconfigPath = rootJsConfig;
  }
  if (tsconfigPath) {
    writeConfigDefaults.writeConfigDefaults(tsconfigPath);
  }
  let future = {
    unstable_cssModules: ((_appConfig$future2 = appConfig.future) === null || _appConfig$future2 === void 0 ? void 0 : _appConfig$future2.unstable_cssModules) === true,
    unstable_cssSideEffectImports: ((_appConfig$future3 = appConfig.future) === null || _appConfig$future3 === void 0 ? void 0 : _appConfig$future3.unstable_cssSideEffectImports) === true,
    unstable_dev: ((_appConfig$future4 = appConfig.future) === null || _appConfig$future4 === void 0 ? void 0 : _appConfig$future4.unstable_dev) ?? false,
    unstable_postcss: ((_appConfig$future5 = appConfig.future) === null || _appConfig$future5 === void 0 ? void 0 : _appConfig$future5.unstable_postcss) === true,
    unstable_tailwind: ((_appConfig$future6 = appConfig.future) === null || _appConfig$future6 === void 0 ? void 0 : _appConfig$future6.unstable_tailwind) === true,
    unstable_vanillaExtract: ((_appConfig$future7 = appConfig.future) === null || _appConfig$future7 === void 0 ? void 0 : _appConfig$future7.unstable_vanillaExtract) === true,
    v2_errorBoundary: ((_appConfig$future8 = appConfig.future) === null || _appConfig$future8 === void 0 ? void 0 : _appConfig$future8.v2_errorBoundary) === true,
    v2_meta: ((_appConfig$future9 = appConfig.future) === null || _appConfig$future9 === void 0 ? void 0 : _appConfig$future9.v2_meta) === true,
    v2_routeConvention: ((_appConfig$future10 = appConfig.future) === null || _appConfig$future10 === void 0 ? void 0 : _appConfig$future10.v2_routeConvention) === true
  };
  let plugins = appConfig.plugins || [];
  return {
    appDirectory,
    cacheDirectory,
    entryClientFile,
    entryClientFilePath,
    entryServerFile,
    entryServerFilePath,
    devServerPort,
    devServerBroadcastDelay,
    assetsBuildDirectory: absoluteAssetsBuildDirectory,
    relativeAssetsBuildDirectory: assetsBuildDirectory,
    publicPath,
    rootDirectory,
    routes: routes$1,
    serverBuildPath,
    serverBuildTarget,
    serverBuildTargetEntryModule,
    serverConditions,
    serverDependenciesToBundle,
    serverEntryPoint,
    serverMainFields,
    serverMinify,
    serverMode,
    serverModuleFormat,
    serverPlatform,
    mdx,
    watchPaths,
    tsconfigPath,
    future,
    plugins
  };
}
function addTrailingSlash(path) {
  return path.endsWith("/") ? path : path + "/";
}
const entryExts = [".js", ".jsx", ".ts", ".tsx"];
function findEntry(dir, basename) {
  for (let ext of entryExts) {
    let file = path__default["default"].resolve(dir, basename + ext);
    if (fse__default["default"].existsSync(file)) return path__default["default"].relative(dir, file);
  }
  return undefined;
}
const configExts = [".js", ".cjs", ".mjs"];
function findConfig(dir, basename, extensions) {
  for (let ext of extensions) {
    let name = basename + ext;
    let file = path__default["default"].join(dir, name);
    if (fse__default["default"].existsSync(file)) return file;
  }
  return undefined;
}
const resolveServerBuildPath = (rootDirectory, appConfig) => {
  let serverBuildPath = "build/index.js";
  switch (appConfig.serverBuildTarget) {
    case "arc":
      serverBuildPath = "server/index.js";
      break;
    case "cloudflare-pages":
      serverBuildPath = "functions/[[path]].js";
      break;
    case "netlify":
      serverBuildPath = ".netlify/functions-internal/server.js";
      break;
    case "vercel":
      serverBuildPath = "api/index.js";
      break;
  }

  // retain deprecated behavior for now
  if (appConfig.serverBuildDirectory) {
    serverBuildPath = path__default["default"].join(appConfig.serverBuildDirectory, "index.js");
  }
  if (appConfig.serverBuildPath) {
    serverBuildPath = appConfig.serverBuildPath;
  }
  return path__default["default"].resolve(rootDirectory, serverBuildPath);
};

// @ts-expect-error available in node 12+
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat#browser_compatibility
let listFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction"
});

exports.findConfig = findConfig;
exports.readConfig = readConfig;
