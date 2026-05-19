/**
 * dynamic-node — Main entry point
 *
 * Re-exports the public API, types, and utilities for consumers.
 */

// === Public API functions ===
export {
  useWarehouse,
  useNamespace,
  useDefaultVersion,
  registerPackage,
  getPackage,
  closePackage,
} from "./api";

// === Tunnel interface & Template ===
export { Tunnel, Template } from "./tunnel";

// === Toolchain (for advanced consumers who need to inspect/override) ===
export { toolchain } from "./toolchain";

// === Error types ===
export { TunnelNotExistError, isTunnelNotExist } from "./remote";

// === Input validation (for advanced consumers) ===
export { allowed, AllowedType } from "./allowed";
