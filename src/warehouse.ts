/**
 * warehouse.ts — Warehouse: orchestrates Local + Remote
 * (counterpart of Go warehouse.go)
 *
 * Local-first strategy: if the package exists locally, load it directly.
 * Otherwise, sync from remote, extract, then load.
 */

import { Local } from "./local";
import { Remote, createRemote } from "./remote";
import { Tunnel } from "./tunnel";

export class Warehouse {
  local: Local | null = null;
  remote: Remote | null = null;

  /**
   * Initializes the warehouse with local and optional remote paths.
   * (counterpart of Go Warehouse.Init)
   */
  init(localPath: string, remotePath: string): void {
    this.local = new Local(localPath);
    this.remote = createRemote(remotePath);
  }

  /**
   * Loads a plugin package by name.
   *
   * Flow (counterpart of Go Warehouse.Load):
   *   1. Check local exists → load directly
   *   2. If not, sync from remote
   *   3. Extract zip
   *   4. Check local exists again → load
   *   5. If still not found → error
   */
  async load(name: string): Promise<Tunnel> {
    console.log(`[dynamic] load warehouse package ${name}...`);

    if (!this.local) {
      throw new Error("dynamic: warehouse not initialized");
    }

    // Try local first
    if (this.local.exists(name)) {
      const tunnel = await this.local.load(name);
      console.log(`[dynamic] load warehouse package ${name} success (local)`);
      return tunnel;
    }

    // No local → sync from remote
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

    const tunnel = await this.local.load(name);
    console.log(`[dynamic] load warehouse package ${name} success (remote)`);
    return tunnel;
  }
}

/** Module-level singleton (counterpart of Go `var warehouse = NewWarehouse()`) */
export const warehouse = new Warehouse();
