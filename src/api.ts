/**
 * api.ts — Public API (counterpart of Go api.go)
 *
 * Top-level functions that the consumer of this library calls.
 */

import { allowed } from "./allowed";
import { warehouse } from "./warehouse";
import { packageCenter } from "./package-center";
import { Tunnel } from "./tunnel";

/**
 * Configures the warehouse with local and optional remote paths.
 *
 * @param local  - Local warehouse directory path (required if either param is non-empty)
 * @param remote - Remote warehouse URL, e.g. "s3://bucket" (optional)
 *
 * Cases (counterpart of Go UseWarehouse):
 *   Case 1: both empty → no warehouse, static packages only
 *   Case 2: local only → local warehouse, no remote sync
 *   Case 3: local + remote → full warehouse with S3 sync
 */
export function useWarehouse(local: string, remote: string): void {
  // Case 1: both empty
  if (!local && !remote) {
    return;
  }

  // Case 2: local only
  if (local && !remote) {
    if (!allowed.isPath(local)) {
      console.log(`[dynamic] invalid local warehouse path: ${local}`);
      throw new Error("dynamic: invalid local warehouse path");
    }
    warehouse.init(local, "");
    console.log(`[dynamic] use local warehouse: ${local}`);
    return;
  }

  // Case 3: local + remote
  if (local && remote) {
    if (!allowed.isPath(local)) {
      console.log(`[dynamic] invalid local warehouse path: ${local}`);
      throw new Error("dynamic: invalid local warehouse path");
    }
    if (!allowed.isURL(remote)) {
      console.log(`[dynamic] invalid remote warehouse URL: ${remote}`);
      throw new Error("dynamic: invalid remote warehouse URL");
    }
    warehouse.init(local, remote);
    console.log(`[dynamic] use local warehouse: ${local}`);
    console.log(`[dynamic] use remote warehouse: ${remote}`);
    return;
  }

  // Invalid: remote without local
  console.log(
    `[dynamic] invalid warehouse configuration: local=${local}, remote=${remote}`
  );
  throw new Error("dynamic: invalid warehouse configuration");
}

/**
 * Sets the package namespace.
 */
export function useNamespace(namespace: string): void {
  if (!allowed.isKeyword(namespace)) {
    throw new Error("dynamic: invalid package namespace");
  }
  packageCenter.useNamespace(namespace);
}

/**
 * Sets the default package version used as fallback.
 */
export function useDefaultVersion(version: string): void {
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid default package version");
  }
  packageCenter.useDefaultVersion(version);
}

/**
 * Registers a static package (bypasses warehouse download).
 */
export async function registerPackage(
  pkg: string,
  version: string,
  tunnel: Tunnel
): Promise<void> {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  await packageCenter.registerPackage(pkg, version, tunnel);
}

/**
 * Gets (or lazily loads) a package by name and version.
 * Returns the Tunnel instance for invoking plugin functionality.
 */
export async function getPackage(
  pkg: string,
  version: string
): Promise<Tunnel> {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  return packageCenter.getTunnel(pkg, version);
}

/**
 * Closes a loaded package, releasing resources.
 */
export async function closePackage(
  pkg: string,
  version: string
): Promise<void> {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  await packageCenter.closePackage(pkg, version);
}
