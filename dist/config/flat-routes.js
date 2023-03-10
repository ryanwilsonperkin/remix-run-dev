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

var path = require('node:path');
var glob = require('fast-glob');
var routes = require('./routes.js');
var routesConvention = require('./routesConvention.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var glob__default = /*#__PURE__*/_interopDefaultLegacy(glob);

function flatRoutes(appDirectory, ignoredFilePatterns) {
  let extensions = routesConvention.routeModuleExts.join(",");
  let routePaths = glob__default["default"].sync(`**/*{${extensions}}`, {
    absolute: true,
    cwd: path__default["default"].join(appDirectory, "routes"),
    ignore: ignoredFilePatterns,
    onlyFiles: true
  });

  // fast-glob will return posix paths even on windows
  // convert posix to os specific paths
  let routePathsForOS = routePaths.map(routePath => {
    return path__default["default"].normalize(routePath);
  });
  return flatRoutesUniversal(appDirectory, routePathsForOS);
}
/**
 * Create route configs from a list of routes using the flat routes conventions.
 * @param {string} appDirectory - The absolute root directory the routes were looked up from.
 * @param {string[]} routePaths - The absolute route paths.
 * @param {string} [prefix=routes] - The prefix to strip off of the routes.
 */
function flatRoutesUniversal(appDirectory, routePaths, prefix = "routes") {
  let routeMap = getRouteMap(appDirectory, routePaths, prefix);
  let uniqueRoutes = new Map();
  let routes$1 = Array.from(routeMap.values());
  function defineNestedRoutes(defineRoute, parentId) {
    let childRoutes = routes$1.filter(routeInfo => {
      return routeInfo.parentId === parentId;
    });
    let parentRoute = parentId ? routeMap.get(parentId) : undefined;
    let parentRoutePath = (parentRoute === null || parentRoute === void 0 ? void 0 : parentRoute.path) ?? "/";
    for (let childRoute of childRoutes) {
      var _childRoute$path;
      let routePath = ((_childRoute$path = childRoute.path) === null || _childRoute$path === void 0 ? void 0 : _childRoute$path.slice(parentRoutePath.length)) ?? "";
      // remove leading slash
      routePath = routePath.replace(/^\//, "");
      let index = childRoute.index;
      let fullPath = childRoute.path;
      let uniqueRouteId = (fullPath || "") + (index ? "?index" : "");
      if (uniqueRouteId) {
        let conflict = uniqueRoutes.get(uniqueRouteId);
        if (conflict) {
          throw new Error(`Path ${JSON.stringify(fullPath)} defined by route ` + `${JSON.stringify(childRoute.id)} ` + `conflicts with route ${JSON.stringify(conflict)}`);
        }
        uniqueRoutes.set(uniqueRouteId, childRoute.id);
      }
      let childRouteOptions = {
        id: path__default["default"].posix.join(prefix, childRoute.id),
        index: childRoute.index ? true : undefined
      };
      if (index) {
        let invalidChildRoutes = routes$1.filter(routeInfo => routeInfo.parentId === childRoute.id);
        if (invalidChildRoutes.length > 0) {
          throw new Error(`Child routes are not allowed in index routes. Please remove child routes of ${childRoute.id}`);
        }
        defineRoute(routePath, childRoute.file, childRouteOptions);
      } else {
        defineRoute(routePath, childRoute.file, childRouteOptions, () => {
          defineNestedRoutes(defineRoute, childRoute.id);
        });
      }
    }
  }
  return routes.defineRoutes(defineNestedRoutes);
}
function isIndexRoute(routeId) {
  return routeId.endsWith("_index");
}
function getRouteSegments(routeId) {
  let routeSegments = [];
  let rawRouteSegments = [];
  let index = 0;
  let routeSegment = "";
  let rawRouteSegment = "";
  let state = "NORMAL";
  let hasFolder = routeId.includes(path__default["default"].posix.sep);

  /**
   * @see https://github.com/remix-run/remix/pull/5160#issuecomment-1402157424
   */
  if (hasFolder && (routeId.endsWith("/index") || routeId.endsWith("/route"))) {
    let last = routeId.lastIndexOf(path__default["default"].posix.sep);
    if (last >= 0) {
      routeId = routeId.substring(0, last);
    }
  }
  let pushRouteSegment = (segment, rawSegment) => {
    if (!segment) return;
    let notSupportedInRR = (segment, char) => {
      throw new Error(`Route segment "${segment}" for "${routeId}" cannot contain "${char}".\n` + `If this is something you need, upvote this proposal for React Router https://github.com/remix-run/react-router/discussions/9822.`);
    };
    if (rawSegment.includes("*")) {
      return notSupportedInRR(rawSegment, "*");
    }
    if (rawSegment.includes(":")) {
      return notSupportedInRR(rawSegment, ":");
    }
    if (rawSegment.includes("/")) {
      return notSupportedInRR(segment, "/");
    }
    routeSegments.push(segment);
    rawRouteSegments.push(rawSegment);
  };
  while (index < routeId.length) {
    let char = routeId[index];
    index++; //advance to next char

    switch (state) {
      case "NORMAL":
        {
          if (routesConvention.isSegmentSeparator(char)) {
            pushRouteSegment(routeSegment, rawRouteSegment);
            routeSegment = "";
            rawRouteSegment = "";
            state = "NORMAL";
            break;
          }
          if (char === routesConvention.escapeStart) {
            state = "ESCAPE";
            rawRouteSegment += char;
            break;
          }
          if (char === routesConvention.optionalStart) {
            state = "OPTIONAL";
            rawRouteSegment += char;
            break;
          }
          if (!routeSegment && char == routesConvention.paramPrefixChar) {
            if (index === routeId.length) {
              routeSegment += "*";
              rawRouteSegment += char;
            } else {
              routeSegment += ":";
              rawRouteSegment += char;
            }
            break;
          }
          routeSegment += char;
          rawRouteSegment += char;
          break;
        }
      case "ESCAPE":
        {
          if (char === routesConvention.escapeEnd) {
            state = "NORMAL";
            rawRouteSegment += char;
            break;
          }
          routeSegment += char;
          rawRouteSegment += char;
          break;
        }
      case "OPTIONAL":
        {
          if (char === routesConvention.optionalEnd) {
            routeSegment += "?";
            rawRouteSegment += char;
            state = "NORMAL";
            break;
          }
          if (char === routesConvention.escapeStart) {
            state = "OPTIONAL_ESCAPE";
            rawRouteSegment += char;
            break;
          }
          if (!routeSegment && char === routesConvention.paramPrefixChar) {
            if (index === routeId.length) {
              routeSegment += "*";
              rawRouteSegment += char;
            } else {
              routeSegment += ":";
              rawRouteSegment += char;
            }
            break;
          }
          routeSegment += char;
          rawRouteSegment += char;
          break;
        }
      case "OPTIONAL_ESCAPE":
        {
          if (char === routesConvention.escapeEnd) {
            state = "OPTIONAL";
            rawRouteSegment += char;
            break;
          }
          routeSegment += char;
          rawRouteSegment += char;
          break;
        }
    }
  }

  // process remaining segment
  pushRouteSegment(routeSegment, rawRouteSegment);
  return [routeSegments, rawRouteSegments];
}
function findParentRouteId(routeInfo, nameMap) {
  let parentName = routeInfo.segments.slice(0, -1).join("/");
  while (parentName) {
    let parentRoute = nameMap.get(parentName);
    if (parentRoute) return parentRoute.id;
    parentName = parentName.substring(0, parentName.lastIndexOf("/"));
  }
  return undefined;
}
function getRouteInfo(appDirectory, routeDirectory, filePath) {
  let filePathWithoutApp = filePath.slice(appDirectory.length + 1);
  let routeId = createFlatRouteId(filePathWithoutApp);
  let routeIdWithoutRoutes = routeId.slice(routeDirectory.length + 1);
  let index = isIndexRoute(routeIdWithoutRoutes);
  let [routeSegments, rawRouteSegments] = getRouteSegments(routeIdWithoutRoutes);
  let routePath = createRoutePath(routeSegments, rawRouteSegments, index);
  return {
    id: routeIdWithoutRoutes,
    path: routePath,
    file: filePathWithoutApp,
    name: routeSegments.join("/"),
    segments: routeSegments,
    index
  };
}
function createRoutePath(routeSegments, rawRouteSegments, isIndex) {
  let result = "";
  if (isIndex) {
    routeSegments = routeSegments.slice(0, -1);
  }
  for (let index = 0; index < routeSegments.length; index++) {
    let segment = routeSegments[index];
    let rawSegment = rawRouteSegments[index];

    // skip pathless layout segments
    if (segment.startsWith("_") && rawSegment.startsWith("_")) {
      continue;
    }

    // remove trailing slash
    if (segment.endsWith("_") && rawSegment.endsWith("_")) {
      segment = segment.slice(0, -1);
    }
    result += `/${segment}`;
  }
  return result || undefined;
}
function getRouteMap(appDirectory, routePaths, prefix) {
  let routeMap = new Map();
  let nameMap = new Map();
  for (let routePath of routePaths) {
    let routesDirectory = path__default["default"].join(appDirectory, prefix);
    let pathWithoutAppRoutes = routePath.slice(routesDirectory.length + 1);
    if (isRouteModuleFile(pathWithoutAppRoutes)) {
      let routeInfo = getRouteInfo(appDirectory, prefix, routePath);
      routeMap.set(routeInfo.id, routeInfo);
      nameMap.set(routeInfo.name, routeInfo);
    }
  }

  // update parentIds for all routes
  for (let routeInfo of routeMap.values()) {
    let parentId = findParentRouteId(routeInfo, nameMap);
    routeInfo.parentId = parentId;
  }
  return routeMap;
}
function isRouteModuleFile(filePath) {
  // flat files only need correct extension
  let normalizedFilePath = routes.normalizeSlashes(filePath);
  let isFlatFile = !filePath.includes(path__default["default"].posix.sep);
  let hasExt = routesConvention.routeModuleExts.includes(path__default["default"].extname(filePath));
  if (isFlatFile) return hasExt;
  let basename = normalizedFilePath.slice(0, -path__default["default"].extname(filePath).length);
  return basename.endsWith(`/route`) || basename.endsWith(`/index`);
}
function createFlatRouteId(filePath) {
  let routeId = routes.createRouteId(filePath);
  if (routeId.includes(path__default["default"].posix.sep) && routeId.endsWith("/index")) {
    routeId = routeId.split(path__default["default"].posix.sep).slice(0, -1).join(path__default["default"].posix.sep);
  }
  return routeId;
}

exports.createRoutePath = createRoutePath;
exports.flatRoutes = flatRoutes;
exports.flatRoutesUniversal = flatRoutesUniversal;
exports.getRouteSegments = getRouteSegments;
exports.isIndexRoute = isIndexRoute;
