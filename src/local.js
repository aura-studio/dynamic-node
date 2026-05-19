/**
 * local.js — Local warehouse
 *
 * Checks whether a plugin package exists locally, extracts zip if needed,
 * and loads the module via require().
 *
 * Returns raw module.exports — no interface constraint.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { toolchain } = require("./toolchain");

class Local {
  constructor(localPath) {
    this._localPath = localPath;
  }

  /** Returns the local warehouse base path */
  getPath() {
    return this._localPath;
  }

  /**
   * Checks whether the plugin package exists locally (unzipped entry files).
   *
   * - bundle variant: checks for bundle.js
   * - full variant:   checks for index.js or package.json
   *
   * Also verifies the zip file exists and is non-zero.
   */
  exists(name) {
    const dir = path.join(this._localPath, toolchain.toString(), name);
    const zipFile = path.join(dir, `libnode_${name}.zip`);

    // Check zip file exists and is non-zero
    try {
      const stat = fs.statSync(zipFile);
      if (stat.size === 0) {
        console.log(`[dynamic] zip file is empty, treating as non-existent: ${zipFile}`);
        return false;
      }
    } catch {
      return false;
    }

    // Check entry files based on variant
    if (toolchain.variant === "bundle") {
      const bundleFile = path.join(dir, "bundle.js");
      try {
        const stat = fs.statSync(bundleFile);
        return stat.size > 0;
      } catch {
        return false;
      }
    } else {
      // full variant: check index.js or package.json
      const indexFile = path.join(dir, "index.js");
      const packageFile = path.join(dir, "package.json");
      try {
        const indexStat = fs.statSync(indexFile);
        if (indexStat.size > 0) return true;
      } catch {
        // index.js not found, check package.json
      }
      try {
        const pkgStat = fs.statSync(packageFile);
        return pkgStat.size > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Extracts the zip file for the given package name into the local directory.
   * The original zip is retained.
   */
  extract(name) {
    const dir = path.join(this._localPath, toolchain.toString(), name);
    const zipFile = path.join(dir, `libnode_${name}.zip`);

    console.log(`[dynamic] extracting ${zipFile} to ${dir}`);

    const zip = new AdmZip(zipFile);
    zip.extractAllTo(dir, true); // overwrite = true
  }

  /**
   * Loads a plugin module via require(), clearing the require cache first.
   *
   * Returns the raw module.exports.
   */
  async load(name) {
    const dir = path.join(this._localPath, toolchain.toString(), name);
    const entryFile =
      toolchain.variant === "bundle"
        ? path.join(dir, "bundle.js")
        : dir; // Node resolves package.json#main automatically

    // Clear require cache to ensure fresh module load
    try {
      const resolved = require.resolve(entryFile);
      delete require.cache[resolved];
    } catch {
      // resolve may fail if module not yet loaded; ignore
    }

    const mod = require(entryFile);

    return mod;
  }
}

module.exports = { Local };
