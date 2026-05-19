/**
 * dynamic-node — Main entry point
 *
 * Re-exports the public API and utilities for consumers.
 *
 * Packages are loaded as raw JS modules. There is no Tunnel abstraction —
 * each package independently exports whatever it needs (handlers, routes,
 * classes, etc.) and registers with the host framework on its own.
 */

"use strict";

const api = require("./api");
const { toolchain } = require("./toolchain");
const { PackageNotExistError, isPackageNotExist } = require("./remote");
const { allowed, AllowedType } = require("./allowed");

module.exports = {
  // Public API functions
  useWarehouse: api.useWarehouse,
  useNamespace: api.useNamespace,
  useDefaultVersion: api.useDefaultVersion,
  registerPackage: api.registerPackage,
  getPackage: api.getPackage,
  closePackage: api.closePackage,

  // Toolchain (for advanced consumers who need to inspect/override)
  toolchain,

  // Error types
  PackageNotExistError,
  isPackageNotExist,

  // Input validation (for advanced consumers)
  allowed,
  AllowedType,
};
