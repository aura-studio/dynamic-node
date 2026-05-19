const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const { Local } = require("../src/local");
const { toolchain } = require("../src/toolchain");
const {
  makeHandlerBundle,
  makeSimpleBundle,
  makeEmptyBundle,
  overrideToolchain,
} = require("./test-helpers");

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-local");

function setupDir(name) {
  const dir = path.join(TMP_ROOT, toolchain.toString(), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createZip(dir, name, content) {
  const zip = new AdmZip();
  zip.addFile("bundle.js", Buffer.from(content, "utf-8"));
  const zipPath = path.join(dir, `libnode_${name}.zip`);
  zip.writeZip(zipPath);
}

function extractZip(dir, name) {
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
    let local;

    beforeAll(() => {
      local = new Local(TMP_ROOT);
      setupDir("test_exists_v1");
    });

    it("returns false when no zip file present", () => {
      setupDir("empty_pkg_v1");
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
      createZip(d, testName, makeHandlerBundle());
      extractZip(d, testName);
      expect(local.exists(testName)).toBe(true);
    });

    it("returns false when zip present but bundle.js not extracted", () => {
      const testName = "no_extract_v1";
      const d = setupDir(testName);
      createZip(d, testName, makeHandlerBundle());
      expect(local.exists(testName)).toBe(false);
    });
  });

  describe("extract", () => {
    it("extracts bundle.js from zip", () => {
      const name = "test_extract_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeHandlerBundle());

      const local = new Local(TMP_ROOT);
      local.extract(name);

      const bundlePath = path.join(dir, "bundle.js");
      expect(fs.existsSync(bundlePath)).toBe(true);
      expect(fs.statSync(bundlePath).size).toBeGreaterThan(0);
    });

    it("retains original zip after extraction", () => {
      const name = "test_retain_zip_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeHandlerBundle());

      const local = new Local(TMP_ROOT);
      local.extract(name);

      const zipPath = path.join(dir, `libnode_${name}.zip`);
      expect(fs.existsSync(zipPath)).toBe(true);
    });
  });

  describe("load", () => {
    it("loads module and returns raw exports (handler pattern)", async () => {
      const name = "test_load_handler_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeHandlerBundle("my-handler"));
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const mod = await local.load(name);
      expect(mod).toBeDefined();
      expect(mod.name).toBe("my-handler");
      expect(mod.VERSION).toBe("1.0.0");
      expect(typeof mod.handler).toBe("function");
    });

    it("loads module and returns raw exports (simple pattern)", async () => {
      const name = "test_load_simple_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeSimpleBundle("hi"));
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const mod = await local.load(name);
      expect(mod).toBeDefined();
      expect(mod.greeting).toBe("hi");
    });

    it("loads empty module without error", async () => {
      const name = "test_load_empty_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeEmptyBundle());
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const mod = await local.load(name);
      expect(mod).toBeDefined();
    });

    it("clears require cache between loads", async () => {
      const name = "test_cache_clear_v1";
      const dir = setupDir(name);
      createZip(dir, name, makeHandlerBundle());
      extractZip(dir, name);

      const local = new Local(TMP_ROOT);
      const t1 = await local.load(name);
      const t2 = await local.load(name);
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
    });
  });
});
