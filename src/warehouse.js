/**
 * warehouse.js — Warehouse: orchestrates Local + Remote
 *
 * Local-first strategy: if the package exists locally, load it directly.
 * Otherwise, sync from remote, extract, then load.
 *
 * Returns the loaded module exports. TunnelCenter resolves those exports to a
 * TunnelNode using the Node equivalent of Go's Tunnel/New plugin symbols.
 */

"use strict";

const { Local } = require("./local");
const { createRemote } = require("./remote");

class Warehouse {
  constructor() {
    this.local = null;
    this.remote = null;
  }

  /**
   * Initializes the warehouse with local and optional remote paths.
   */
  init(localPath, remotePath) {
    this.local = new Local(localPath);
    this.remote = createRemote(remotePath);
  }

  /**
   * Loads a plugin package by name.
   *
   * Flow:
   *   1. Check local exists -> load directly
   *   2. If not, sync from remote
   *   3. Extract zip
   *   4. Check local exists again -> load
   *   5. If still not found -> error
   *
   * Returns module.exports from the loaded bundle.
   */
  async load(name) {
    console.log(`[dynamic] load warehouse package ${name}...`);

    if (!this.local) {
      throw new Error("dynamic: warehouse not initialized");
    }

    // Try local first
    if (this.local.exists(name)) {
      const mod = await this.local.load(name);
      console.log(`[dynamic] load warehouse package ${name} success (local)`);
      return mod;
    }

    // No local -> sync from remote
    if (!this.remote) {
      throw new Error("dynamic: warehouse package not exists");
    }

    await this.remote.sync(name, this.local.getPath());

    // Extract the downloaded zip
    this.local.extract(name);

    // Verify extraction succeeded
    if (!this.local.exists(name)) {
      throw new Error("dynamic: warehouse package not exists after extraction");
    }

    const mod = await this.local.load(name);
    console.log(`[dynamic] load warehouse package ${name} success (remote)`);
    return mod;
  }
}

/** Module-level singleton */
const warehouse = new Warehouse();

module.exports = { Warehouse, warehouse };
