/**
 * package-center.js — PackageCenter: namespace + version management + memory cache
 *
 * Manages loaded packages with a two-level cache:
 *   Level 1: PackageCenter.packages (in-memory Map)
 *   Level 2: Warehouse (local disk + S3 remote)
 *
 * Each package is identified by (namespace, pkg, version).
 * Multiple packages can coexist independently.
 * If the same pkg+version is loaded again, the later load overwrites the earlier one.
 */

"use strict";

const { warehouse } = require("./warehouse");

const NAMESPACE_DEFAULT = "default";
const VERSION_DEFAULT = "default";

// ---------------------------------------------------------------------------
// PackageCenter
// ---------------------------------------------------------------------------

class PackageCenter {
  constructor() {
    this._namespace = NAMESPACE_DEFAULT;
    this._defaultVersion = VERSION_DEFAULT;
    this._packages = new Map();
  }

  useNamespace(ns) {
    this._namespace = ns;
  }

  useDefaultVersion(v) {
    this._defaultVersion = v;
  }

  /**
   * Build the cache key from namespace, pkg, and version.
   */
  _key(pkg, version) {
    return `${this._namespace}_${pkg}_${version}`;
  }

  /**
   * Gets a loaded module for the given package + version.
   *
   * Resolution order:
   *   1. Memory cache with provided version
   *   2. Warehouse load with provided version
   *   3. Memory cache with default version
   *   4. Warehouse load with default version
   *   5. Error if neither found
   */
  async getPackage(pkg, version) {
    // --- Try provided version ---
    const key = this._key(pkg, version);

    // Level 1: memory cache
    if (this._packages.has(key)) {
      return this._packages.get(key);
    }

    // Level 2: Warehouse (local disk + S3)
    try {
      const mod = await warehouse.load(key);
      this._packages.set(key, mod);
      return mod;
    } catch (err) {
      console.log(`[dynamic] load package ${key} failed: ${err}`);
    }

    // --- Try default version ---
    const defaultKey = this._key(pkg, this._defaultVersion);

    // Level 1: memory cache (default version)
    if (this._packages.has(defaultKey)) {
      const mod = this._packages.get(defaultKey);
      // Back-fill the provided version into cache
      this._packages.set(key, mod);
      return mod;
    }

    // Level 2: Warehouse (default version)
    try {
      const mod = await warehouse.load(defaultKey);
      this._packages.set(key, mod);
      this._packages.set(defaultKey, mod);
      return mod;
    } catch (err) {
      console.log(`[dynamic] load package ${defaultKey} failed: ${err}`);
    }

    throw new Error(
      `dynamic: both provided version and default version not found, ` +
        `package: ${pkg}, provided version: ${version}, default version: ${this._defaultVersion}`
    );
  }

  /**
   * Closes a package, removing it from the cache.
   */
  async closePackage(pkg, version) {
    const key = this._key(pkg, version);
    this._packages.delete(key);
  }

  /**
   * Registers a static package directly (bypasses warehouse).
   * If the same pkg+version already exists, it is overwritten.
   */
  async registerPackage(pkg, version, mod) {
    const key = this._key(pkg, version);
    this._packages.set(key, mod);
  }
}

/** Module-level singleton */
const packageCenter = new PackageCenter();

module.exports = { PackageCenter, packageCenter };
