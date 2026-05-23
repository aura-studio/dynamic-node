"use strict";

const { tunnelCenter } = require("./tunnel-center");
const { callTunnelClose } = require("./tunnel");

const NAMESPACE_DEFAULT = "default";
const VERSION_DEFAULT = "default";
const VERSION_LATEST = "latest";

class DynamicIndex {
  constructor(namespace, pkg, version) {
    this.namespace = namespace;
    this.package = pkg;
    this.version = version;
  }

  toString() {
    return [this.namespace, this.package, this.version].join("_");
  }
}

class Dynamic {
  constructor(index, tunnel) {
    this.index = index;
    this.tunnel = tunnel;
  }

  getTunnel() {
    return this.tunnel;
  }
}

class PackageCenter {
  constructor(center = tunnelCenter) {
    this._namespace = NAMESPACE_DEFAULT;
    this._defaultVersion = VERSION_DEFAULT;
    this._tunnelCenter = center;
    this._dynamics = new Map();
  }

  useNamespace(ns) {
    this._namespace = ns;
  }

  useDefaultVersion(v) {
    this._defaultVersion = v;
  }

  _index(pkg, version) {
    return new DynamicIndex(this._namespace, pkg, version);
  }

  async getTunnel(pkg, version) {
    const providedIndex = this._index(pkg, version);
    const providedKey = providedIndex.toString();

    if (this._dynamics.has(providedKey)) {
      return this._dynamics.get(providedKey).getTunnel();
    }

    try {
      const tunnel = await this._tunnelCenter.getTunnel(providedKey);
      this._cache(pkg, version, tunnel);
      return tunnel;
    } catch (err) {
      console.log(`[dynamic] get tunnel ${providedKey} failed: ${err}`);
    }

    const defaultIndex = this._index(pkg, this._defaultVersion);
    const defaultKey = defaultIndex.toString();

    if (this._dynamics.has(defaultKey)) {
      const tunnel = this._dynamics.get(defaultKey).getTunnel();
      this._cache(pkg, version, tunnel);
      return tunnel;
    }

    try {
      const tunnel = await this._tunnelCenter.getTunnel(defaultKey);
      this._cache(pkg, version, tunnel);
      this._cache(pkg, this._defaultVersion, tunnel);
      return tunnel;
    } catch (err) {
      console.log(`[dynamic] get tunnel ${defaultKey} failed: ${err}`);
    }

    throw new Error(
      `dynamic: both provided version and default version not found, ` +
        `package: ${pkg}, provided version: ${version}, default version: ${this._defaultVersion}`
    );
  }

  async getPackage(pkg, version) {
    return this.getTunnel(pkg, version);
  }

  async closePackage(pkg, version) {
    const index = this._index(pkg, version);
    const key = index.toString();
    const dynamic = this._dynamics.get(key);
    if (!dynamic) {
      return;
    }

    await callTunnelClose(dynamic.getTunnel());
    this._dynamics.delete(key);
  }

  async registerPackage(pkg, version, tunnelLike) {
    const index = this._index(pkg, version);
    const tunnel = await this._tunnelCenter.registerTunnel(
      index.toString(),
      tunnelLike
    );
    this._dynamics.set(index.toString(), new Dynamic(index, tunnel));
    return tunnel;
  }

  _cache(pkg, version, tunnel) {
    const index = this._index(pkg, version);
    this._dynamics.set(index.toString(), new Dynamic(index, tunnel));
    return index;
  }
}

const packageCenter = new PackageCenter();

module.exports = {
  NAMESPACE_DEFAULT,
  VERSION_DEFAULT,
  VERSION_LATEST,
  DynamicIndex,
  Dynamic,
  PackageCenter,
  packageCenter,
};
