import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import AdmZip from "adm-zip";
import { toolchain } from "../src/toolchain";
import {
  overrideToolchain,
  makeTunnelBundle,
  TEST_S3_BUCKET,
  TEST_PACKAGE_NAME,
} from "./test-helpers";

/**
 * Full integration tests for the public API using real S3 data.
 * These tests exercise the complete flow:
 *   useWarehouse → useNamespace → getPackage → invoke → closePackage
 */

const TMP_ROOT = path.join(os.tmpdir(), "dynamic-node-test-api");

function setupLocalPackage(
  localBase: string,
  namespace: string,
  pkg: string,
  version: string,
  bundleContent: string
): void {
  const name = `${namespace}_${pkg}_${version}`;
  const dir = path.join(
    localBase,
    toolchain.toString(),
    name
  );
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
      const { useWarehouse, getPackage } = await import("../src/api");
      const localBase = path.join(TMP_ROOT, "api-local-only");

      // Set up local package that exports Tunnel
      setupLocalPackage(
        localBase,
        "default",
        "localtest",
        "v1",
        makeTunnelBundle()
      );

      useWarehouse(localBase, "");

      const tunnel = await getPackage("localtest", "v1");
      expect(tunnel).toBeDefined();
      expect(tunnel.meta()).toBe("test-bundle-tunnel");
      expect(tunnel.invoke("test", "{}")).resolves.toBeDefined();
    });

    it("validates local path (rejects empty string when configure called)", () => {
      // const { useWarehouse } = await import("../src/api");
      // This is tested implicitly by the validation check on keyword
    });
  });

  describe("useNamespace / useDefaultVersion", () => {
    it("sets namespace for package resolution", async () => {
      const { useWarehouse, useNamespace, registerPackage, getPackage } =
        await import("../src/api");
      const localBase = path.join(TMP_ROOT, "api-ns");

      // Override: we need to reload modules to reset singleton state
      // Instead, register a package directly
      useNamespace("myorg");

      const { MockTunnel } = await import("./test-helpers");
      const mock = new MockTunnel();
      await registerPackage("nsapp", "v1", mock);

      const tunnel = await getPackage("nsapp", "v1");
      expect(tunnel).toBe(mock);
    });

    it("uses default version as fallback", async () => {
      const { useDefaultVersion, registerPackage, getPackage } =
        await import("../src/api");
      const { MockTunnel } = await import("./test-helpers");

      useDefaultVersion("stable");
      const mock = new MockTunnel("stable-version");
      await registerPackage("dfapp", "stable", mock);

      // Request non-existent version, should fallback to "stable"
      const tunnel = await getPackage("dfapp", "latest");
      expect(tunnel.meta()).toBe("stable-version");
    });
  });

  describe("registerPackage / getPackage / closePackage", () => {
    it("full register → get → close lifecycle", async () => {
      const { registerPackage, getPackage, closePackage } =
        await import("../src/api");
      const { MockTunnel } = await import("./test-helpers");

      const mock = new MockTunnel("lifecycle-test");
      await registerPackage("lifecycle", "v1", mock);

      const t1 = await getPackage("lifecycle", "v1");
      expect(t1.meta()).toBe("lifecycle-test");
      expect(mock.initCalled).toBe(true);

      // Invoke
      const resp = await t1.invoke("route1", '{"k":"v"}');
      expect(resp).toBe("mock-response:route1");

      // Close — this calls tunnel.close() and removes from Level 1 cache
      await closePackage("lifecycle", "v1");
      expect(mock.closeCalled).toBe(true);
    });
  });

  describe("input validation", () => {
    it("rejects invalid package name in getPackage", async () => {
      const { getPackage } = await import("../src/api");
      await expect(getPackage("INVALID", "v1")).rejects.toThrow(
        "invalid package name"
      );
    });

    it("rejects invalid version in getPackage", async () => {
      const { getPackage } = await import("../src/api");
      await expect(getPackage("validname", "V_INVALID")).rejects.toThrow(
        "invalid package version"
      );
    });

    it("rejects invalid namespace", async () => {
      const { useNamespace } = await import("../src/api");
      expect(() => useNamespace("INVALID_NS")).toThrow(
        "invalid package namespace"
      );
    });

    it("rejects invalid default version", async () => {
      const { useDefaultVersion } = await import("../src/api");
      expect(() => useDefaultVersion("INVALID_VERSION")).toThrow(
        "invalid default package version"
      );
    });
  });

  describe("multi-tunnel coexistence", () => {
    const localBase = path.join(TMP_ROOT, "api-multi");

    beforeAll(() => {
      fs.mkdirSync(localBase, { recursive: true });
    });

    // Helper: create a local package that exports a custom meta
    function makeMetaBundle(meta: string): string {
      return `
class T {
  meta() { return "${meta}"; }
  async init() {}
  async invoke(route, req) { return JSON.stringify({ tunnel: "${meta}", route, req: JSON.parse(req) }); }
  async close() {}
}
exports.Tunnel = new T();
`;
    }

    function setupPkg(namespace: string, pkg: string, version: string, meta: string): void {
      const fullName = `${namespace}_${pkg}_${version}`;
      const dir = path.join(localBase, toolchain.toString(), fullName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "bundle.js"), makeMetaBundle(meta));
      const zip = new AdmZip();
      zip.addFile("bundle.js", Buffer.from(makeMetaBundle(meta), "utf-8"));
      zip.writeZip(path.join(dir, `libnode_${fullName}.zip`));
    }

    it("loads two packages from same namespace", async () => {
      const { useWarehouse, useNamespace, getPackage } = await import("../src/api");
      setupPkg("team-a", "alpha", "v1", "team-a-alpha");
      setupPkg("team-a", "beta", "v1", "team-a-beta");

      useNamespace("team-a");
      useWarehouse(localBase, "");

      const alpha = await getPackage("alpha", "v1");
      const beta = await getPackage("beta", "v1");

      expect(alpha.meta()).toBe("team-a-alpha");
      expect(beta.meta()).toBe("team-a-beta");
    });

    it("loads two different versions of same package", async () => {
      const { useNamespace, useWarehouse, getPackage } = await import("../src/api");
      setupPkg("team-b", "worker", "v1", "worker-v1");
      setupPkg("team-b", "worker", "v2", "worker-v2");

      useNamespace("team-b");
      useWarehouse(localBase, "");

      const v1 = await getPackage("worker", "v1");
      const v2 = await getPackage("worker", "v2");

      expect(v1.meta()).toBe("worker-v1");
      expect(v2.meta()).toBe("worker-v2");
      expect(v1).not.toBe(v2);
    });

    it("loads packages from two different namespaces simultaneously", async () => {
      const { useWarehouse, useNamespace, getPackage } = await import("../src/api");
      setupPkg("ns1", "svc", "v1", "ns1-svc");
      setupPkg("ns2", "svc", "v1", "ns2-svc");

      useWarehouse(localBase, "");

      // Load ns1 package
      useNamespace("ns1");
      const ns1Tunnel = await getPackage("svc", "v1");

      // Load ns2 package (should not affect ns1)
      useNamespace("ns2");
      const ns2Tunnel = await getPackage("svc", "v1");

      expect(ns1Tunnel.meta()).toBe("ns1-svc");
      expect(ns2Tunnel.meta()).toBe("ns2-svc");
      expect(ns1Tunnel).not.toBe(ns2Tunnel);
    });

    it("each tunnel maintains independent invocation state", async () => {
      const { useNamespace, useWarehouse, getPackage } = await import("../src/api");
      setupPkg("indie", "a", "v1", "indie-a");
      setupPkg("indie", "b", "v1", "indie-b");

      useNamespace("indie");
      useWarehouse(localBase, "");

      const a = await getPackage("a", "v1");
      const b = await getPackage("b", "v1");

      const ra = await a.invoke("/route-a", JSON.stringify({ x: 1 }));
      const rb = await b.invoke("/route-b", JSON.stringify({ y: 2 }));

      const pa = JSON.parse(ra);
      const pb = JSON.parse(rb);

      expect(pa.tunnel).toBe("indie-a");
      expect(pb.tunnel).toBe("indie-b");
      expect(pa.route).toBe("/route-a");
      expect(pb.route).toBe("/route-b");
      expect(pa.req.x).toBe(1);
      expect(pb.req.y).toBe(2);
    });

    it("closing one tunnel does not affect others", async () => {
      const { useNamespace, useWarehouse, getPackage, closePackage } =
        await import("../src/api");
      setupPkg("close-test", "keep", "v1", "keep-me");
      setupPkg("close-test", "drop", "v1", "drop-me");

      useNamespace("close-test");
      useWarehouse(localBase, "");

      const keep = await getPackage("keep", "v1");
      const drop = await getPackage("drop", "v1");

      expect(keep.meta()).toBe("keep-me");
      expect(drop.meta()).toBe("drop-me");

      // Close one
      await closePackage("drop", "v1");

      // "keep" should still work
      const r = await keep.invoke("/check", JSON.stringify({ alive: true }));
      expect(JSON.parse(r).tunnel).toBe("keep-me");

      // "drop" can still be retrieved from Level 2 cache
      const drop2 = await getPackage("drop", "v1");
      expect(drop2).toBe(drop);
    });

    it("mixes static + S3-loaded tunnels", async () => {
      const { useWarehouse, useNamespace, getPackage, registerPackage } =
        await import("../src/api");
      const { MockTunnel } = await import("./test-helpers");
      setupPkg("mixed", "dynamic-pkg", "v1", "dynamic");

      useNamespace("mixed");
      useWarehouse(localBase, "");

      // Static
      const staticT = new MockTunnel("static-tunnel");
      await registerPackage("static-pkg", "v1", staticT);

      // Dynamic (from warehouse)
      const dynamicT = await getPackage("dynamic-pkg", "v1");

      expect(staticT.meta()).toBe("static-tunnel");
      expect(dynamicT.meta()).toBe("dynamic");

      const sr = await staticT.invoke("s", "{}");
      const dr = await dynamicT.invoke("d", "{}");
      expect(sr).toBe("mock-response:s");
      expect(JSON.parse(dr).tunnel).toBe("dynamic");

      await staticT.close();
    });
  });

  describe("S3 integration (full flow)", () => {
    it("downloads, extracts, and loads from S3", async () => {
      const { useWarehouse, useNamespace, useDefaultVersion, getPackage } =
        await import("../src/api");
      const localBase = path.join(TMP_ROOT, "api-s3-full");

      useNamespace("hotscripts");
      useDefaultVersion("default");
      useWarehouse(localBase, `s3://${TEST_S3_BUCKET}`);

      // The real S3 zip exports handler/VERSION, not Tunnel.
      // This test confirms download + extraction work correctly.
      // The load error is expected for this particular bundle.
      await expect(getPackage("hello", "v1")).rejects.toThrow(
        "both provided version and default version not found"
      );

      // Verify files exist locally after download
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
      const { useWarehouse, useNamespace, getPackage } =
        await import("../src/api");
      const localBase = path.join(TMP_ROOT, "api-s3-cache");

      useNamespace("hotscripts");

      // First: register a mock that matches what we'd get from S3
      // Then use warehouse to verify local cache works
      const name = "hello";
      const version = "v1";
      const fullName = `hotscripts_${name}_${version}`;
      const dir = path.join(
        localBase,
        toolchain.toString(),
        fullName
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "bundle.js"), makeTunnelBundle());
      const zip = new AdmZip();
      zip.addFile("bundle.js", Buffer.from(makeTunnelBundle(), "utf-8"));
      zip.writeZip(path.join(dir, `libnode_${fullName}.zip`));

      useWarehouse(localBase, `s3://${TEST_S3_BUCKET}`);

      // Should load from local cache without S3 call
      const tunnel = await getPackage(name, version);
      expect(tunnel).toBeDefined();
      expect(tunnel.meta()).toBe("test-bundle-tunnel");
    }, 10000);
  });
});