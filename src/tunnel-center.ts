/**
 * tunnel-center.ts — TunnelCenter: loaded Tunnel registry + lazy loading
 * (counterpart of Go TunnelCenter in tunnel.go)
 *
 * Manages already-initialized Tunnel instances. When a tunnel is requested
 * and not yet loaded, delegates to the warehouse to download/load it.
 */

import { Tunnel } from "./tunnel";
import { warehouse } from "./warehouse";

export class TunnelCenter {
  private tunnels: Map<string, Tunnel> = new Map();

  /**
   * Gets or lazily loads a Tunnel by name.
   *
   * If already cached, returns immediately.
   * Otherwise, loads from warehouse, calls tunnel.init(), caches, and returns.
   */
  async getTunnel(name: string): Promise<Tunnel> {
    const cached = this.tunnels.get(name);
    if (cached) {
      return cached;
    }

    const tunnel = await warehouse.load(name);
    await tunnel.init();
    this.tunnels.set(name, tunnel);

    return tunnel;
  }

  /**
   * Closes and removes a tunnel from the registry.
   */
  async closeTunnel(name: string): Promise<void> {
    const tunnel = this.tunnels.get(name);
    if (tunnel) {
      await tunnel.close();
      this.tunnels.delete(name);
    }
  }

  /**
   * Iterates over all registered tunnels.
   */
  rangeTunnel(fn: (name: string, tunnel: Tunnel) => boolean): void {
    for (const [name, tunnel] of this.tunnels) {
      if (!fn(name, tunnel)) break;
    }
  }

  /**
   * Directly registers a pre-initialized tunnel (usually for debug/testing).
   */
  async registerTunnel(name: string, tunnel: Tunnel): Promise<void> {
    await tunnel.init();
    this.tunnels.set(name, tunnel);
  }
}

/** Module-level singleton (counterpart of Go `var tunnelCenter = NewTunnelCenter()`) */
export const tunnelCenter = new TunnelCenter();
