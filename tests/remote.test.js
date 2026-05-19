const fs = require("fs");
const path = require("path");
const os = require("os");
const { Local } = require("../src/local");
const { toolchain } = require("../src/toolchain");
const {
  TEST_S3_BUCKET,
  TEST_PACKAGE_NAME,
  overrideToolchain,
} = require("./test-helpers");

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-remote");

describe("Remote (S3 integration)", () => {
  beforeAll(() => {
    overrideToolchain();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  function getRemote() {
    const { createRemote } = require("../src/remote");
    return { createRemote };
  }

  describe("createRemote", () => {
    it("returns null for empty remote path", () => {
      const { createRemote } = getRemote();
      expect(createRemote("")).toBeNull();
    });

    it("creates S3 remote for s3:// URL", () => {
      const { createRemote } = getRemote();
      const remote = createRemote(`s3://${TEST_S3_BUCKET}`);
      expect(remote).not.toBeNull();
      expect(remote.getPath()).toBe(`s3://${TEST_S3_BUCKET}`);
    });

    it("throws for unknown scheme", () => {
      const { createRemote } = getRemote();
      expect(() => createRemote("ftp://example.com")).toThrow(
        "unknown remote scheme"
      );
    });

    it("throws for malformed URL", () => {
      const { createRemote } = getRemote();
      expect(() => createRemote("not-a-url")).toThrow("invalid remote URL");
    });
  });

  describe("S3 sync", () => {
    it("downloads real zip from S3 (aws-3 profile)", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = getRemote();
      const remote = createRemote(remotePath);

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
      const { createRemote } = getRemote();
      const remote = createRemote(remotePath);

      await expect(
        remote.sync(TEST_PACKAGE_NAME, TMP_ROOT)
      ).resolves.toBeUndefined();
    });

    it("re-downloads when file exists but is zero bytes", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = getRemote();
      const remote = createRemote(remotePath);

      const emptyName = "hotscripts_hello_v1";
      const dir = path.join(
        TMP_ROOT,
        toolchain.toString(),
        emptyName
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `libnode_${emptyName}.zip`),
        ""
      );

      await expect(
        remote.sync(emptyName, TMP_ROOT)
      ).resolves.toBeUndefined();
    }, 20000);

    it("throws PackageNotExistError for non-existent package", async () => {
      const remotePath = `s3://${TEST_S3_BUCKET}`;
      const { createRemote } = getRemote();
      const remote = createRemote(remotePath);

      await expect(
        remote.sync("nonexistent_pkg_v999", TMP_ROOT)
      ).rejects.toThrow("S3 object not found");
    }, 20000);
  });
});
