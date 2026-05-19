/**
 * package-center.ts — DynamicCenter: namespace + version management + memory cache
 * (counterpart of Go package.go)
 *
 * Provides a three-level cache:
 *   Level 1: DynamicCenter.dynamics (in-memory Map, keyed by DynamicIndex)
 *   Level 2: TunnelCenter.tunnels (loaded Tunnel instances)
 *   Level 3: Warehouse (local disk + S3 remote)
 */

import { Tunnel } from "./tunnel";
import { tunnelCenter } from "./tunnel-center";

const NAMESPACE_DEFAULT = "default";
const VERSION_DEFAULT = "default";

// ---------------------------------------------------------------------------
// DynamicIndex — composite key for the dynamics cache
// ---------------------------------------------------------------------------

class DynamicIndex {
  constructor(
    public readonly namespace: string,
    public readonly pkg: string,
    public readonly version: string
  ) {}

  toString(): string {
    return `${this.namespace}_${this.pkg}_${this.version}`;
  }
}

// ---------------------------------------------------------------------------
// Dynamic — a cached Tunnel with its index
// ---------------------------------------------------------------------------

class Dynamic {
  constructor(
    public readonly index: DynamicIndex,
    public readonly tunnel: Tunnel
  ) {}
}

// ---------------------------------------------------------------------------
// DynamicCenter
// ---------------------------------------------------------------------------

export class DynamicCenter {
  private namespace: string = NAMESPACE_DEFAULT;
  private defaultVersion: string = VERSION_DEFAULT;
  private dynamics: Map<string, Dynamic> = new Map();

  useNamespace(ns: string): void {
    this.namespace = ns;
  }

  useDefaultVersion(v: string): void {
    this.defaultVersion = v;
  }

  /**
   * Gets a Tunnel for the given package + version.
   *
   * Resolution order (counterpart of Go DynamicCenter.GetTunnel):
   *   1. Level 1 cache with provided version
   *   2. Level 2 (TunnelCenter) with provided version
   *   3. Level 1 cache with default version
   *   4. Level 2 (TunnelCenter) with default version
   *   5. Error if neither found
   */
  async getTunnel(pkg: string, version: string): Promise<Tunnel> {
    // --- Try provided version ---

    const index = new DynamicIndex(this.namespace, pkg, version);
    const key = index.toString();

    // Level 1: memory cache
    const cached = this.dynamics.get(key);
    if (cached) {
      return cached.tunnel;
    }

    // Level 2+3: TunnelCenter (which delegates to Warehouse)
    try {
      const tunnel = await tunnelCenter.getTunnel(key);
      this.cache(pkg, version, tunnel);
      return tunnel;
    } catch (err) {
      console.log(`[dynamic] get tunnel ${key} failed: ${err}`);
    }

    // --- Try default version ---

    const defaultIndex = new DynamicIndex(
      this.namespace,
      pkg,
      this.defaultVersion
    );
    const defaultKey = defaultIndex.toString();

    // Level 1: memory cache (default version)
    const defaultCached = this.dynamics.get(defaultKey);
    if (defaultCached) {
      // Back-fill the provided version into cache
      this.cache(pkg, version, defaultCached.tunnel);
      return defaultCached.tunnel;
    }

    // Level 2+3: TunnelCenter (default version)
    try {
      const tunnel = await tunnelCenter.getTunnel(defaultKey);
      this.cache(pkg, version, tunnel);
      this.cache(pkg, this.defaultVersion, tunnel);
      return tunnel;
    } catch (err) {
      console.log(`[dynamic] get tunnel ${defaultKey} failed: ${err}`);
    }

    throw new Error(
      `dynamic: both provided version and default version not found, ` +
        `package: ${pkg}, provided version: ${version}, default version: ${this.defaultVersion}`
    );
  }

  /**
   * Closes a package, removing it from the cache and closing the tunnel.
   */
  async closePackage(pkg: string, version: string): Promise<void> {
    const index = new DynamicIndex(this.namespace, pkg, version);
    const key = index.toString();
    const dynamic = this.dynamics.get(key);
    if (dynamic) {
      await dynamic.tunnel.close();
      this.dynamics.delete(key);
    }
  }

  /**
   * Registers a static package directly (bypasses warehouse).
   */
  async registerPackage(
    pkg: string,
    version: string,
    tunnel: Tunnel
  ): Promise<void> {
    const index = new DynamicIndex(this.namespace, pkg, version);
    this.cache(pkg, version, tunnel);
    await tunnelCenter.registerTunnel(index.toString(), tunnel);
  }

  /**
   * Writes a tunnel into the Level 1 cache.
   */
  private cache(pkg: string, version: string, tunnel: Tunnel): void {
    const index = new DynamicIndex(this.namespace, pkg, version);
    const dynamic = new Dynamic(index, tunnel);
    this.dynamics.set(index.toString(), dynamic);
  }
}

/** Module-level singleton (counterpart of Go `var packageCenter = NewPackageCenter()`) */
export const packageCenter = new DynamicCenter();
