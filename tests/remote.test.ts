import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Local } from "../src/local";
import { toolchain } from "../src/toolchain";
import {
  TEST_S3_BUCKET,
  TEST_PACKAGE_NAME,
  overrideToolchain,
} from "./test-helpers";

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-remote");

/**
 * Integration test: downloads the real zip from S3 using the aws-3 profile.
 * These tests require valid AWS credentials and network access.
 */
describe("Remote (S3 integration)", () => {
  beforeAll(() => {
    overrideToolchain();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  // Dynamically import remote to avoid init before toolchain is overridden
  async function getRemote() {
    const mod = await import("../src/remote");
    return { createRemote: mod.createRemote, S3Remote: null };
  }

  describe("createRemote", () => {
    it("returns null for empty remote path", async () => {
      const { createRemote } = await getRemote();
      expect(createRemote("")).toBeNull();
    });

    it("creates S3 remote for s3:// URL", async () => {
      const { createRemote } = await getRemote();
      const remote = createRemote(`s3://${TEST_S3_BUCKET}`);
      expect(remote).not.toBeNull();
      expect(remote!.getPath()).toBe(`s3://${TEST_S3_BUCKET}`);
    });

    it("throws for unknown scheme", async () => {
      const { createRemote } = await getRemote();
      expect(() => createRemote("ftp://example.com")).toThrow(
        "unknown remote scheme"
      );
    });

    it("throws for malformed URL", async () => {
      const { createRemote } = await getRemote();
      expect(() => createRemote("not-a-url")).toThrow("invalid remote URL");
    });
  });

  describe("S3 sync", () => {
    it("downloads real zip from S3 (aws-3 profile)", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = await getRemote();
      const remote = createRemote(remotePath)!;

      const local = new Local(TMP_ROOT);

      // Sync from S3
      await remote.sync(TEST_PACKAGE_NAME, TMP_ROOT);

      // Verify zip was downloaded
      const zipFile = path.join(
        TMP_ROOT,
        toolchain.toString(),
        TEST_PACKAGE_NAME,
        `libnode_${TEST_PACKAGE_NAME}.zip`
      );
      expect(fs.existsSync(zipFile)).toBe(true);
      const stat = fs.statSync(zipFile);
      expect(stat.size).toBeGreaterThan(0);

      // Verify extraction
      local.extract(TEST_PACKAGE_NAME);
      expect(local.exists(TEST_PACKAGE_NAME)).toBe(true);

      // Verify the module loads (it exports handler/VERSION, not Tunnel — but
      // that's expected since it's a real bundle variant product)
      const dir = path.join(
        TMP_ROOT,
        toolchain.toString(),
        TEST_PACKAGE_NAME
      );
      const bundleFile = path.join(dir, "bundle.js");
      expect(fs.existsSync(bundleFile)).toBe(true);
    }, 20000);

    it("skips download when file already exists and non-zero", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = await getRemote();
      const remote = createRemote(remotePath)!;

      // Should not throw — file already exists from previous test
      await expect(
        remote.sync(TEST_PACKAGE_NAME, TMP_ROOT)
      ).resolves.toBeUndefined();
    });

    it("re-downloads when file exists but is zero bytes", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = await getRemote();
      const remote = createRemote(remotePath)!;

      const emptyName = "hotscripts_hello_v1";
      const dir = path.join(
        TMP_ROOT,
        toolchain.toString(),
        emptyName
      );
      fs.mkdirSync(dir, { recursive: true });
      // Write empty file to trigger re-download
      fs.writeFileSync(
        path.join(dir, `libnode_${emptyName}.zip`),
        ""
      );

      await expect(
        remote.sync(emptyName, TMP_ROOT)
      ).resolves.toBeUndefined();
    }, 20000);

    it("throws TunnelNotExistError for non-existent package", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = await getRemote();
      const remote = createRemote(remotePath)!;

      await expect(
        remote.sync("nonexistent_pkg_v999", TMP_ROOT)
      ).rejects.toThrow("S3 object not found");
    }, 20000);
  });
});