const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const { toolchain } = require("../src/toolchain");
const {
  overrideToolchain,
  makeHandlerBundle,
  TEST_S3_BUCKET,
  TEST_PACKAGE_NAME,
} = require("./test-helpers");

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-api");

function setupLocalPackage(localBase, namespace, pkg, version, bundleContent) {
  const name = `${namespace}_${pkg}_${version}`;
  const dir = path.join(localBase, toolchain.toString(), name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bundle.js"), bundleContent);
  const zip = new AdmZip();
  zip.addFile("bundle.js", Buffer.from(bundleContent, "utf-8"));
  zip.writeZip(path.join(dir, `libnode_${name}.zip`));
}

describe("API (integration)", () => {
  beforeAll(() => {
    overrideToolchain();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  describe("useWarehouse", () => {
    it("configures local-only warehouse", async () => {
      const { useWarehouse, getPackage } = require("../src/api");
      const localBase = path.join(TMP_ROOT, "api-local-only");

      setupLocalPackage(
        localBase,
        "default",
        "localtest",
        "v1",
        makeHandlerBundle("local-handler")
      );

      useWarehouse(localBase, "");

      const mod = await getPackage("localtest", "v1");
      expect(mod).toBeDefined();
      expect(mod.name).toBe("local-handler");
      expect(mod.VERSION).toBe("1.0.0");
      expect(typeof mod.handler).toBe("function");
    });
  });

  describe("useNamespace / useDefaultVersion", () => {
    it("sets namespace for package resolution", async () => {
      const { useNamespace, registerPackage, getPackage } = require("../src/api");

      useNamespace("myorg");

      const mod = {
        name: "myorg-app",
        version: "1.0",
        init() {},
        async invoke() {
          return "myorg-app";
        },
        meta() {
          return "";
        },
        close() {},
      };
      await registerPackage("nsapp", "v1", mod);

      const result = await getPackage("nsapp", "v1");
      expect(result).toBe(mod);
    });

    it("uses default version as fallback", async () => {
      const { useDefaultVersion, registerPackage, getPackage } = require("../src/api");

      useDefaultVersion("stable");
      const mod = {
        name: "stable-version",
        init() {},
        async invoke() {
          return "stable-version";
        },
        meta() {
          return "";
        },
        close() {},
      };
      await registerPackage("dfapp", "stable", mod);

      const result = await getPackage("dfapp", "latest");
      expect(result.name).toBe("stable-version");
    });
  });

  describe("registerPackage / getPackage / closePackage", () => {
    it("full register -> get -> close lifecycle", async () => {
      const { registerPackage, getPackage, closePackage } = require("../src/api");

      const mod = {
        name: "lifecycle-test",
        init() {},
        async invoke() {
          return "response";
        },
        async handler() {
          return "response";
        },
        meta() {
          return "";
        },
        close() {},
      };
      await registerPackage("lifecycle", "v1", mod);

      const result = await getPackage("lifecycle", "v1");
      expect(result.name).toBe("lifecycle-test");
      expect(typeof result.handler).toBe("function");

      const resp = await result.handler();
      expect(resp).toBe("response");

      await closePackage("lifecycle", "v1");
    });
  });

  describe("input validation", () => {
    it("rejects invalid package name in getPackage", async () => {
      const { getPackage } = require("../src/api");
      await expect(getPackage("INVALID", "v1")).rejects.toThrow(
        "invalid package name"
      );
    });

    it("rejects invalid version in getPackage", async () => {
      const { getPackage } = require("../src/api");
      await expect(getPackage("validname", "V_INVALID")).rejects.toThrow(
        "invalid package version"
      );
    });

    it("rejects invalid namespace", () => {
      const { useNamespace } = require("../src/api");
      expect(() => useNamespace("INVALID_NS")).toThrow(
        "invalid package namespace"
      );
    });

    it("rejects invalid default version", () => {
      const { useDefaultVersion } = require("../src/api");
      expect(() => useDefaultVersion("INVALID_VERSION")).toThrow(
        "invalid default package version"
      );
    });
  });

  describe("multi-package coexistence", () => {
    const localBase = path.join(TMP_ROOT, "api-multi");

    beforeAll(() => {
      fs.mkdirSync(localBase, { recursive: true });
    });

    function makeNamedBundle(name) {
      return `
exports.name = "${name}";
async function handler(route, req) {
  return JSON.stringify({ module: "${name}", route, req: JSON.parse(req) });
}
exports.handler = handler;
exports.Tunnel = {
  name: "${name}",
  handler,
  init() {},
  async invoke(route, req) {
    return handler(route, req);
  },
  meta() {
    return JSON.stringify({ name: "${name}" });
  },
  close() {},
};
`;
    }

    function setupPkg(namespace, pkg, version, name) {
      const fullName = `${namespace}_${pkg}_${version}`;
      const dir = path.join(localBase, toolchain.toString(), fullName);
      fs.mkdirSync(dir, { recursive: true });
      const content = makeNamedBundle(name);
      fs.writeFileSync(path.join(dir, "bundle.js"), content);
      const zip = new AdmZip();
      zip.addFile("bundle.js", Buffer.from(content, "utf-8"));
      zip.writeZip(path.join(dir, `libnode_${fullName}.zip`));
    }

    it("loads two packages from same namespace", async () => {
      const { useWarehouse, useNamespace, getPackage } = require("../src/api");
      setupPkg("team-a", "alpha", "v1", "team-a-alpha");
      setupPkg("team-a", "beta", "v1", "team-a-beta");

      useNamespace("team-a");
      useWarehouse(localBase, "");

      const alpha = await getPackage("alpha", "v1");
      const beta = await getPackage("beta", "v1");

      expect(alpha.name).toBe("team-a-alpha");
      expect(beta.name).toBe("team-a-beta");
    });

    it("loads two different versions of same package", async () => {
      const { useNamespace, useWarehouse, getPackage } = require("../src/api");
      setupPkg("team-b", "worker", "v1", "worker-v1");
      setupPkg("team-b", "worker", "v2", "worker-v2");

      useNamespace("team-b");
      useWarehouse(localBase, "");

      const v1 = await getPackage("worker", "v1");
      const v2 = await getPackage("worker", "v2");

      expect(v1.name).toBe("worker-v1");
      expect(v2.name).toBe("worker-v2");
      expect(v1).not.toBe(v2);
    });

    it("loads packages from two different namespaces simultaneously", async () => {
      const { useWarehouse, useNamespace, getPackage } = require("../src/api");
      setupPkg("ns1", "svc", "v1", "ns1-svc");
      setupPkg("ns2", "svc", "v1", "ns2-svc");

      useWarehouse(localBase, "");

      useNamespace("ns1");
      const ns1Mod = await getPackage("svc", "v1");

      useNamespace("ns2");
      const ns2Mod = await getPackage("svc", "v1");

      expect(ns1Mod.name).toBe("ns1-svc");
      expect(ns2Mod.name).toBe("ns2-svc");
      expect(ns1Mod).not.toBe(ns2Mod);
    });

    it("each module maintains independent state", async () => {
      const { useNamespace, useWarehouse, getPackage } = require("../src/api");
      setupPkg("indie", "a", "v1", "indie-a");
      setupPkg("indie", "b", "v1", "indie-b");

      useNamespace("indie");
      useWarehouse(localBase, "");

      const a = await getPackage("a", "v1");
      const b = await getPackage("b", "v1");

      const ra = await a.handler("/route-a", JSON.stringify({ x: 1 }));
      const rb = await b.handler("/route-b", JSON.stringify({ y: 2 }));

      const pa = JSON.parse(ra);
      const pb = JSON.parse(rb);

      expect(pa.module).toBe("indie-a");
      expect(pb.module).toBe("indie-b");
    });

    it("closing one package does not affect others", async () => {
      const { useNamespace, useWarehouse, getPackage, closePackage } = require("../src/api");
      setupPkg("close-test", "keep", "v1", "keep-me");
      setupPkg("close-test", "drop", "v1", "drop-me");

      useNamespace("close-test");
      useWarehouse(localBase, "");

      const keep = await getPackage("keep", "v1");
      await getPackage("drop", "v1");

      await closePackage("drop", "v1");

      const r = await keep.handler("/check", JSON.stringify({ alive: true }));
      expect(JSON.parse(r).module).toBe("keep-me");
    });

    it("mixes static + warehouse-loaded packages", async () => {
      const { useWarehouse, useNamespace, getPackage, registerPackage } = require("../src/api");
      setupPkg("mixed", "dynamic-pkg", "v1", "dynamic");

      useNamespace("mixed");
      useWarehouse(localBase, "");

      const staticMod = {
        name: "static-module",
        greet: () => "hello",
        init() {},
        async invoke() {
          return "hello";
        },
        meta() {
          return "";
        },
        close() {},
      };
      await registerPackage("static-pkg", "v1", staticMod);

      const dynamicMod = await getPackage("dynamic-pkg", "v1");

      expect(staticMod.name).toBe("static-module");
      expect(dynamicMod.name).toBe("dynamic");

      expect(staticMod.greet()).toBe("hello");
      const dr = await dynamicMod.handler("d", "{}");
      expect(JSON.parse(dr).module).toBe("dynamic");
    });
  });

  const describeS3 =
    process.env.DYNAMIC_NODE_RUN_S3_TESTS === "1" ? describe : describe.skip;

  describeS3("S3 integration (full flow)", () => {
    it("downloads, extracts, and loads from S3", async () => {
      const { useWarehouse, useNamespace, useDefaultVersion, getPackage } = require("../src/api");
      const localBase = path.join(TMP_ROOT, "api-s3-full");

      useNamespace("hotscripts");
      useDefaultVersion("default");
      useWarehouse(localBase, `s3://${TEST_S3_BUCKET}`);

      const mod = await getPackage("hello", "v1");
      expect(mod).toBeDefined();

      const dir = path.join(
        localBase,
        toolchain.toString(),
        TEST_PACKAGE_NAME
      );
      expect(fs.existsSync(path.join(dir, "bundle.js"))).toBe(true);
      expect(
        fs.existsSync(path.join(dir, `libnode_${TEST_PACKAGE_NAME}.zip`))
      ).toBe(true);
    }, 30000);

    it("second run uses local cache (no S3 call)", async () => {
      const { useWarehouse, useNamespace, getPackage } = require("../src/api");
      const localBase = path.join(TMP_ROOT, "api-s3-cache");

      // Use a different namespace to avoid hitting Level 1 cache
      useNamespace("hotscripts-cache");

      const name = "hello";
      const version = "v1";
      const fullName = `hotscripts-cache_${name}_${version}`;
      const dir = path.join(
        localBase,
        toolchain.toString(),
        fullName
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "bundle.js"), makeHandlerBundle("cached"));
      const zip = new AdmZip();
      zip.addFile("bundle.js", Buffer.from(makeHandlerBundle("cached"), "utf-8"));
      zip.writeZip(path.join(dir, `libnode_${fullName}.zip`));

      useWarehouse(localBase, `s3://${TEST_S3_BUCKET}`);

      const mod = await getPackage(name, version);
      expect(mod).toBeDefined();
      expect(mod.name).toBe("cached");
    }, 10000);
  });
});
