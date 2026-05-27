"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const AdmZip = require("adm-zip");
const { toolchain } = require("./toolchain");

const DEFAULT_FALLBACK_EXTRACT_ROOT = path.join(os.tmpdir(), ".dynamic-warehouse");

class Local {
  constructor(localPath) {
    this._localPath = localPath;
    this._extractPath = isWritable(localPath)
      ? localPath
      : DEFAULT_FALLBACK_EXTRACT_ROOT;
    if (this._extractPath !== this._localPath) {
      console.log(
        `[dynamic] warehouse ${localPath} is not writable, will extract to ${this._extractPath}`
      );
    }
  }

  getPath() {
    return this._localPath;
  }

  getExtractPath() {
    return this._extractPath;
  }

  exists(name) {
    if (!this.hasArchive(name)) {
      return false;
    }

    const dir = path.join(this._extractPath, toolchain.toString(), name);

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

  hasArchive(name) {
    const zipFile = path.join(
      this._localPath,
      toolchain.toString(),
      name,
      `libnode_${name}.zip`
    );

    try {
      const stat = fs.statSync(zipFile);
      if (stat.size === 0) {
        console.log(`[dynamic] zip file is empty, treating as non-existent: ${zipFile}`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  extract(name) {
    const srcDir = path.join(this._localPath, toolchain.toString(), name);
    const dstDir = path.join(this._extractPath, toolchain.toString(), name);
    const zipFile = path.join(srcDir, `libnode_${name}.zip`);

    console.log(`[dynamic] extracting ${zipFile} to ${dstDir}`);

    fs.mkdirSync(dstDir, { recursive: true });
    const zip = new AdmZip(zipFile);
    zip.extractAllTo(dstDir, true);
  }

  async load(name) {
    const dir = path.join(this._extractPath, toolchain.toString(), name);
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

function isWritable(p) {
  try {
    fs.accessSync(p, fs.constants.W_OK);
    return true;
  } catch (err) {
    if (err && err.code === "ENOENT") {
      // Path doesn't exist yet — try to create it so subsequent extract calls succeed.
      try {
        fs.mkdirSync(p, { recursive: true });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

module.exports = { Local };
