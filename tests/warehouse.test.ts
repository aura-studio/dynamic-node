import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import AdmZip from "adm-zip";
import { Warehouse, warehouse as singletonWarehouse } from "../src/warehouse";
import { Tunnel } from "../src/tunnel";
import {
  makeTunnelBundle,
  makeNoTunnelBundle,
  overrideToolchain,
  TEST_S3_BUCKET,
  TEST_PACKAGE_NAME,
} from "./test-helpers";

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-warehouse");

function setupLocalPackage(
  localBase: string,
  name: string,
  bundleContent: string
): void {
  const dir = path.join(
    localBase,
    // Use overrideToolchain() values
    "darwin15.7.3_amd64v1_node25.8.0_bundle",
    name
  );
  fs.mkdirSync(dir, { recursive: true });
  // Write extracted bundle
  fs.writeFileSync(path.join(dir, "bundle.js"), bundleContent);
  // Write zip
  const zip = new AdmZip();
  zip.addFile("bundle.js", Buffer.from(bundleContent, "utf-8"));
  zip.writeZip(path.join(dir, `libnode_${name}.zip`));
}

describe("Warehouse", () => {
  beforeAll(() => {
    overrideToolchain();
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  describe("init", () => {
    it("initializes with local only", () => {
      const w = new Warehouse();
      w.init("/tmp/test-local", "");
      expect(w.local).not.toBeNull();
      expect(w.remote).toBeNull();
    });

    it("initializes with local and remote", () => {
      const w = new Warehouse();
      w.init("/tmp/test-local", "s3://test-bucket");
      expect(w.local).not.toBeNull();
      expect(w.remote).not.toBeNull();
      expect(w.remote!.getPath()).toBe("s3://test-bucket");
    });
  });

  describe("load (local only)", () => {
    it("loads from local when package exists", async () => {
      const name = "test_w_local_v1";
      const localBase = path.join(TMP_ROOT, "local-only");
      setupLocalPackage(localBase, name, makeTunnelBundle());

      const w = new Warehouse();
      w.init(localBase, "");

      const tunnel = await w.load(name);
      expect(tunnel).toBeDefined();
      expect(tunnel.meta()).toBe("test-bundle-tunnel");
    });

    it("throws when local not initialized", async () => {
      const w = new Warehouse();
      await expect(w.load("any")).rejects.toThrow(
        "warehouse not initialized"
      );
    });

    it("throws when no remote configured and local missing", async () => {
      const w = new Warehouse();
      w.init(path.join(TMP_ROOT, "empty"), "");
      await expect(w.load("nonexistent_v1")).rejects.toThrow(
        "warehouse package not exists"
      );
    });
  });

  describe("load (local + remote integration)", () => {
    it("loads actual package from S3 via warehouse", async () => {
      const localBase = path.join(TMP_ROOT, "s3-integration");
      fs.mkdirSync(localBase, { recursive: true });

      const w = new Warehouse();
      w.init(localBase, `s3://${TEST_S3_BUCKET}`);

      // This will download from S3, extract, and try to load.
      // The real bundle exports handler/VERSION, not Tunnel, so load() will fail.
      // That's expected behavior — the load function requires Tunnel/New.
      // The important part is download + extraction work.
      await expect(w.load(TEST_PACKAGE_NAME)).rejects.toThrow(
        'module "hotscripts_hello_v1" does not export Tunnel or New'
      );

      // But verify files exist locally
      const dir = path.join(
        localBase,
        "darwin15.7.3_amd64v1_node25.8.0_bundle",
        TEST_PACKAGE_NAME
      );
      expect(fs.existsSync(path.join(dir, "bundle.js"))).toBe(true);
      expect(
        fs.existsSync(path.join(dir, `libnode_${TEST_PACKAGE_NAME}.zip`))
      ).toBe(true);
    }, 30000);

    it("second load hits local cache (no re-download)", async () => {
      const localBase = path.join(TMP_ROOT, "s3-cache-test");
      fs.mkdirSync(localBase, { recursive: true });

      // Pre-create the local package with a valid Tunnel bundle
      const name = "test_w_s3_local_v1";
      setupLocalPackage(localBase, name, makeTunnelBundle());

      const w = new Warehouse();
      // Even with remote configured, local hit should skip remote
      w.init(localBase, `s3://${TEST_S3_BUCKET}`);

      const tunnel = await w.load(name);
      expect(tunnel).toBeDefined();
      expect(tunnel.meta()).toBe("test-bundle-tunnel");
    }, 10000);
  });

  describe("singleton", () => {
    it("is not initialized by default", () => {
      expect(singletonWarehouse.local).toBeNull();
      expect(singletonWarehouse.remote).toBeNull();
    });
  });
});