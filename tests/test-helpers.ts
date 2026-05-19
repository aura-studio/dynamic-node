/**
 * test-helpers.ts — Shared test helpers and mock implementations
 */

import { Tunnel } from "../src/tunnel";
import { toolchain as globalToolchain } from "../src/toolchain";

/** S3 bucket used for integration tests */
export const TEST_S3_BUCKET = "dynamic-loader-code-255491288557";

/** Toolchain values matching the S3 path for integration tests */
export const TEST_TOOLCHAIN = {
  os: "darwin15.7.3",
  arch: "amd64v1",
  compiler: "node25.8.0",
  variant: "bundle",
};

/** Package name matching the S3 path */
export const TEST_PACKAGE_NAME = "hotscripts_hello_v1";
export const TEST_NAMESPACE = "hotscripts";
export const TEST_PACKAGE = "hello";
export const TEST_VERSION = "v1";

/**
 * Override the global toolchain to match the S3 test data.
 * Must be called in beforeAll.
 */
export function overrideToolchain(): void {
  globalToolchain.setOS(TEST_TOOLCHAIN.os);
  globalToolchain.setArch(TEST_TOOLCHAIN.arch);
  globalToolchain.setCompiler(TEST_TOOLCHAIN.compiler);
  globalToolchain.setVariant(TEST_TOOLCHAIN.variant);
}

// ---------------------------------------------------------------------------
// Mock Tunnel (for unit tests)
// ---------------------------------------------------------------------------

export class MockTunnel implements Tunnel {
  public initCalled = false;
  public closeCalled = false;
  public invokeLog: Array<{ route: string; req: string }> = [];
  private _meta: string;

  constructor(meta = "mock-tunnel") {
    this._meta = meta;
  }

  meta(): string {
    return this._meta;
  }

  async init(): Promise<void> {
    this.initCalled = true;
  }

  async invoke(route: string, req: string): Promise<string> {
    this.invokeLog.push({ route, req });
    return `mock-response:${route}`;
  }

  async close(): Promise<void> {
    this.closeCalled = true;
  }

  reset(): void {
    this.initCalled = false;
    this.closeCalled = false;
    this.invokeLog = [];
  }
}

// ---------------------------------------------------------------------------
// Self-contained bundle.js generators (no external imports)
// These are written to temp directories and loaded via require().
// ---------------------------------------------------------------------------

/**
 * Creates a bundle.js content string that exports a Tunnel instance.
 * Fully self-contained — does not require() any external packages.
 */
export function makeTunnelBundle(): string {
  return `
class TestTunnel {
  meta() { return "test-bundle-tunnel"; }
  async init() {}
  async invoke(route, req) { return JSON.stringify({ route, req }); }
  async close() {}
}
exports.Tunnel = new TestTunnel();
`;
}

/**
 * Creates a bundle.js content string that exports a New factory.
 */
export function makeNewFactoryBundle(): string {
  return `
class TestTunnel {
  meta() { return "test-factory-tunnel"; }
  async init() {}
  async invoke(route, req) { return JSON.stringify({ route, req }); }
  async close() {}
}
exports.New = () => new TestTunnel();
`;
}

/**
 * Creates a bundle.js content string that does NOT export Tunnel or New.
 */
export function makeNoTunnelBundle(): string {
  return `
exports.handler = async () => ({ statusCode: 200 });
exports.VERSION = "1.0.0";
`;
}