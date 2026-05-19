/**
 * tunnel.ts — Tunnel interface + Template default implementation
 * (counterpart of Go tunnel.go)
 *
 * Every dynamically loaded plugin must export either:
 *   - module.exports.Tunnel = new MyTunnel()   (instance)
 *   - module.exports.New    = () => new MyTunnel()  (factory)
 */

/**
 * Tunnel is the plugin contract. All dynamically loaded plugins must
 * conform to this interface.
 */
export interface Tunnel {
  /** Returns metadata about the tunnel */
  meta(): string;

  /** Initializes the tunnel (async, counterpart of Go Init which is sync) */
  init(): Promise<void>;

  /** Invokes a route with a request string, returns a response string */
  invoke(route: string, req: string): Promise<string>;

  /** Closes and cleans up the tunnel */
  close(): Promise<void>;
}

/**
 * Template provides a no-op default implementation of the Tunnel interface.
 * Plugin authors can extend this class to inherit defaults for methods they
 * don't need to override.
 */
export class Template implements Tunnel {
  meta(): string {
    return "";
  }

  async init(): Promise<void> {
    // no-op
  }

  async invoke(_route: string, _req: string): Promise<string> {
    return "";
  }

  async close(): Promise<void> {
    // no-op
  }
}
