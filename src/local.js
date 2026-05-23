"use strict";

const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { toolchain } = require("./toolchain");

class Local {
  constructor(localPath) {
    this._localPath = localPath;
  }

  getPath() {
    return this._localPath;
  }

  exists(name) {
    const dir = path.join(this._localPath, toolchain.toString(), name);
    const zipFile = path.join(dir, `libnode_${name}.zip`);

    try {
      const stat = fs.statSync(zipFile);
      if (stat.size === 0) {
        console.log(`[dynamic] zip file is empty, treating as non-existent: ${zipFile}`);
        return false;
      }
    } catch {
      return false;
    }

    if (toolchain.variant === "bundle") {
      const bundleFile = path.join(dir, "bundle.js");
      try {
        const stat = fs.statSync(bundleFile);
        return stat.size > 0;
      } catch {
        return false;
      }
    }

    const indexFile = path.join(dir, "index.js");
    const packageFile = path.join(dir, "package.json");
    try {
      const indexStat = fs.statSync(indexFile);
      if (indexStat.size > 0) return true;
    } catch {
      // index.js not found, check package.json.
    }

    try {
      const pkgStat = fs.statSync(packageFile);
      return pkgStat.size > 0;
    } catch {
      return false;
    }
  }

  extract(name) {
    const dir = path.join(this._localPath, toolchain.toString(), name);
    const zipFile = path.join(dir, `libnode_${name}.zip`);

    console.log(`[dynamic] extracting ${zipFile} to ${dir}`);

    const zip = new AdmZip(zipFile);
    zip.extractAllTo(dir, true);
  }

  async load(name) {
    const dir = path.join(this._localPath, toolchain.toString(), name);
    const entryFile =
      toolchain.variant === "bundle"
        ? path.join(dir, "bundle.js")
        : dir;

    try {
      const resolved = require.resolve(entryFile);
      delete require.cache[resolved];
    } catch {
      // resolve may fail if module was not loaded before.
    }

    return require(entryFile);
  }
}

module.exports = { Local };
