/**
 * api.js — Public API
 *
 * Top-level functions that the consumer of this library calls.
 * Packages are loaded as raw JS modules — no interface constraint.
 */

"use strict";

const { allowed } = require("./allowed");
const { warehouse } = require("./warehouse");
const { packageCenter } = require("./package-center");

/**
 * Configures the warehouse with local and optional remote paths.
 *
 * @param {string} local  - Local warehouse directory path
 * @param {string} remote - Remote warehouse URL, e.g. "s3://bucket" (optional)
 */
function useWarehouse(local, remote) {
  // Case 1: both empty
  if (!local && !remote) {
    return;
  }

  // Case 2: local only
  if (local && !remote) {
    if (!allowed.isPath(local)) {
      console.log(`[dynamic] invalid local warehouse path: ${local}`);
      throw new Error("dynamic: invalid local warehouse path");
    }
    warehouse.init(local, "");
    console.log(`[dynamic] use local warehouse: ${local}`);
    return;
  }

  // Case 3: local + remote
  if (local && remote) {
    if (!allowed.isPath(local)) {
      console.log(`[dynamic] invalid local warehouse path: ${local}`);
      throw new Error("dynamic: invalid local warehouse path");
    }
    if (!allowed.isURL(remote)) {
      console.log(`[dynamic] invalid remote warehouse URL: ${remote}`);
      throw new Error("dynamic: invalid remote warehouse URL");
    }
    warehouse.init(local, remote);
    console.log(`[dynamic] use local warehouse: ${local}`);
    console.log(`[dynamic] use remote warehouse: ${remote}`);
    return;
  }

  // Invalid: remote without local
  console.log(
    `[dynamic] invalid warehouse configuration: local=${local}, remote=${remote}`
  );
  throw new Error("dynamic: invalid warehouse configuration");
}

/**
 * Sets the package namespace.
 */
function useNamespace(namespace) {
  if (!allowed.isKeyword(namespace)) {
    throw new Error("dynamic: invalid package namespace");
  }
  packageCenter.useNamespace(namespace);
}

/**
 * Sets the default package version used as fallback.
 */
function useDefaultVersion(version) {
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid default package version");
  }
  packageCenter.useDefaultVersion(version);
}

/**
 * Registers a static package (bypasses warehouse download).
 * The module can be any object — it will be returned as-is by getPackage.
 */
async function registerPackage(pkg, version, mod) {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  await packageCenter.registerPackage(pkg, version, mod);
}

/**
 * Gets (or lazily loads) a package by name and version.
 * Returns the raw module.exports from the loaded bundle.
 */
async function getPackage(pkg, version) {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  return packageCenter.getPackage(pkg, version);
}

/**
 * Closes a loaded package, releasing resources.
 */
async function closePackage(pkg, version) {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  await packageCenter.closePackage(pkg, version);
}

module.exports = {
  useWarehouse,
  useNamespace,
  useDefaultVersion,
  registerPackage,
  getPackage,
  closePackage,
};
