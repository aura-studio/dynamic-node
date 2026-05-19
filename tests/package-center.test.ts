import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DynamicCenter, packageCenter as singleton } from "../src/package-center";
import { Tunnel } from "../src/tunnel";
import { MockTunnel } from "./test-helpers";

describe("DynamicCenter", () => {
  let center: DynamicCenter;

  beforeEach(() => {
    center = new DynamicCenter();
    // Reset singleton state between tests where used
  });

  describe("useNamespace / useDefaultVersion", () => {
    it("defaults to 'default' namespace and version", async () => {
      const m = new MockTunnel();
      await center.registerPackage("pkg", "v1", m);
      // Access via default namespace should work
      const t = await center.getTunnel("pkg", "v1");
      expect(t).toBe(m);
    });

    it("uses custom namespace", async () => {
      center.useNamespace("myorg");
      const m = new MockTunnel();
      await center.registerPackage("pkg", "v1", m);
      const t = await center.getTunnel("pkg", "v1");
      expect(t).toBe(m);
    });

    it("uses custom defaultVersion as fallback", async () => {
      center.useDefaultVersion("stable");
      const m = new MockTunnel();
      await center.registerPackage("pkg", "stable", m);

      // Request "latest" — should fallback to "stable"
      const t = await center.getTunnel("pkg", "latest");
      expect(t).toBe(m);
    });
  });

  describe("registerPackage", () => {
    it("registers and returns via getTunnel (Level 1 cache)", async () => {
      const m = new MockTunnel();
      await center.registerPackage("myapp", "v1", m);

      const t = await center.getTunnel("myapp", "v1");
      expect(t).toBe(m);
      expect(m.initCalled).toBe(true);
    });

    it("calls tunnel.init() during registration", async () => {
      const m = new MockTunnel();
      await center.registerPackage("app", "v2", m);
      // registerPackage → tunnelCenter.registerTunnel → tunnel.init()
      expect(m.initCalled).toBe(true);
    });
  });

  describe("getTunnel", () => {
    it("returns cached tunnel (Level 1 hit)", async () => {
      const m = new MockTunnel();
      await center.registerPackage("cached", "v1", m);

      // Second call should return cached instance without re-init
      m.reset();
      const t = await center.getTunnel("cached", "v1");
      expect(t).toBe(m);
      expect(m.initCalled).toBe(false); // not re-initialized from cache
    });

    it("throws when neither version found", async () => {
      await expect(
        center.getTunnel("nonexistent", "v999")
      ).rejects.toThrow("both provided version and default version not found");
    });
  });

  describe("closePackage", () => {
    it("closes and removes from Level 1 cache", async () => {
      const m = new MockTunnel();
      await center.registerPackage("temp", "v1", m);

      await center.closePackage("temp", "v1");
      expect(m.closeCalled).toBe(true);

      // Tunnel can still be retrieved from Level 2 (tunnelCenter)
      // Go has the same behavior — close only clears Level 1
      const t = await center.getTunnel("temp", "v1");
      expect(t).toBe(m);
    });

    it("does nothing for non-existent package", async () => {
      await expect(
        center.closePackage("nonexistent", "v1")
      ).resolves.toBeUndefined();
    });
  });

  describe("version fallback chain", () => {
    it("prioritizes exact version over default", async () => {
      center.useDefaultVersion("default");
      const exact = new MockTunnel("exact");
      const def = new MockTunnel("default");
      await center.registerPackage("app", "v2", exact);
      await center.registerPackage("app", "default", def);

      const t = await center.getTunnel("app", "v2");
      expect(t.meta()).toBe("exact");
    });

    it("falls back to default version when exact not found", async () => {
      center.useDefaultVersion("default");
      const def = new MockTunnel("default");
      await center.registerPackage("app", "default", def);

      const t = await center.getTunnel("app", "v99");
      expect(t.meta()).toBe("default");
    });
  });

  describe("singleton", () => {
    it("is a shared instance", () => {
      expect(singleton).toBeDefined();
    });
  });
});