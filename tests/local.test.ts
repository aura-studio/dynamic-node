import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import AdmZip from "adm-zip";
import { Local } from "../src/local";
import { toolchain } from "../src/toolchain";
import {
  makeTunnelBundle,
  makeNewFactoryBundle,
  makeNoTunnelBundle,
  overrideToolchain,
} from "./test-helpers";

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-local");

function setupDir(name: string): string {
  const dir = path.join(
    TMP_ROOT,
    toolchain.toString(),
    name
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createZip(dir: string, name: string, content: string): void {
  const zip = new AdmZip();
  zip.addFile("bundle.js", Buffer.from(content, "utf-8"));
  const zipPath = path.join(dir, `libnode_${name}.zip`);
  zip.writeZip(zipPath);
}

function extractZip(dir: string, name: string): void {
  const zipPath = path.join(dir, `libnode_${name}.zip`);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dir, true);
}

describe("Local", () => {
  beforeAll(() => {
    overrideToolchain();
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  describe("exists", () => {
    const name = "test_exists_v1";
    let dir: string;
    let local: Local;

    beforeAll(() => {
      local = new Local(TMP_ROOT);
      dir = setupDir(name);
    });

    it("returns false when no zip file present", () => {
      const emptyDir = setupDir("empty_pkg_v1");
      expect(local.exists("empty_pkg_v1")).toBe(false);
    });

    it("returns false when zip is 0 bytes", () => {
      const testName = "zero_zip_v1";
      const d = setupDir(testName);
      const zipPath = path.join(d, `libnode_${testName}.zip`);
      fs.writeFileSync(zipPath, "");
      expect(local.exists(testName)).toBe(false);
    });

    it("returns true when bundle.js extracted and zip present", () => {
      const testName = "valid_bundle_v1";
      const d = setupDir(testName);
      createZip(d, testName, makeTunnelBundle());
      extractZip(d, testName);
      expect(local.exists(testName)).toBe(true);
    });

    it("returns false when zip present but bundle.js not extracted", () => {
      const testName = "no_extract_v1";
      const d = setupDir(testName);
      createZip(d, testName, makeTunnelBundle());
      // Don't extract
      expect(local.exists(testName)).toBe(false);
    });
  });

  describe("extract", () => {
    it("extracts bundle.js from zip", () => {
      const name = "test_extract_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeTunnelBundle());

      const local = new Local(TMP_ROOT);
      local.extract(name);

      const bundlePath = path.join(dir, "bundle.js");
      expect(fs.existsSync(bundlePath)).toBe(true);
      expect(fs.statSync(bundlePath).size).toBeGreaterThan(0);
    });

    it("retains original zip after extraction", () => {
      const name = "test_retain_zip_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeTunnelBundle());

      const local = new Local(TMP_ROOT);
      local.extract(name);

      const zipPath = path.join(dir, `libnode_${name}.zip`);
      expect(fs.existsSync(zipPath)).toBe(true);
    });
  });

  describe("load", () => {
    it("loads module exporting Tunnel instance", async () => {
      const name = "test_load_tunnel_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeTunnelBundle());
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const tunnel = await local.load(name);
      expect(tunnel).toBeDefined();
      expect(tunnel.meta()).toBe("test-bundle-tunnel");
    });

    it("loads module exporting New factory", async () => {
      const name = "test_load_new_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeNewFactoryBundle());
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const tunnel = await local.load(name);
      expect(tunnel).toBeDefined();
      expect(tunnel.meta()).toBe("test-factory-tunnel");
    });

    it("throws when module exports neither Tunnel nor New", async () => {
      const name = "test_load_none_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeNoTunnelBundle());
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      await expect(local.load(name)).rejects.toThrow(
        'module "test_load_none_v1" does not export Tunnel or New'
      );
    });

    it("clears require cache between loads", async () => {
      const name = "test_cache_clear_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeTunnelBundle());
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const t1 = await local.load(name);
      const t2 = await local.load(name);
      // Should succeed both times without error
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
    });
  });
});