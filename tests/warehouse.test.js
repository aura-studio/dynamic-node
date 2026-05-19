const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const { Warehouse, warehouse: singletonWarehouse } = require("../src/warehouse");
const {
  makeHandlerBundle,
  overrideToolchain,
  TEST_S3_BUCKET,
  TEST_PACKAGE_NAME,
} = require("./test-helpers");

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-warehouse");

function setupLocalPackage(localBase, name, bundleContent) {
  const dir = path.join(
    localBase,
    "darwin15.7.3_amd64v1_node25.8.0_bundle",
    name
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bundle.js"), bundleContent);
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
      expect(w.remote.getPath()).toBe("s3://test-bucket");
    });
  });

  describe("load (local only)", () => {
    it("loads from local when package exists", async () => {
      const name = "test_w_local_v1";
      const localBase = path.join(TMP_ROOT, "local-only");
      setupLocalPackage(localBase, name, makeHandlerBundle("test-handler"));

      const w = new Warehouse();
      w.init(localBase, "");

      const mod = await w.load(name);
      expect(mod).toBeDefined();
      expect(mod.name).toBe("test-handler");
      expect(mod.VERSION).toBe("1.0.0");
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

      const mod = await w.load(TEST_PACKAGE_NAME);
      expect(mod).toBeDefined();

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

      const name = "test_w_s3_local_v1";
      setupLocalPackage(localBase, name, makeHandlerBundle("cached-handler"));

      const w = new Warehouse();
      w.init(localBase, `s3://${TEST_S3_BUCKET}`);

      const mod = await w.load(name);
      expect(mod).toBeDefined();
      expect(mod.name).toBe("cached-handler");
    }, 10000);
  });

  describe("singleton", () => {
    it("is not initialized by default", () => {
      expect(singletonWarehouse.local).toBeNull();
      expect(singletonWarehouse.remote).toBeNull();
    });
  });
});
