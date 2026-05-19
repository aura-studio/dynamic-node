import { describe, it, expect, beforeEach } from "vitest";
import { Tunnel } from "../src/tunnel";
import { TunnelCenter } from "../src/tunnel-center";
import { MockTunnel } from "./test-helpers";

describe("TunnelCenter", () => {
  let center: TunnelCenter;
  let mock: MockTunnel;

  beforeEach(() => {
    center = new TunnelCenter();
    mock = new MockTunnel();
  });

  describe("registerTunnel", () => {
    it("registers and initializes a tunnel", async () => {
      await center.registerTunnel("test-pkg", mock);
      expect(mock.initCalled).toBe(true);
    });

    it("stores tunnel for retrieval", async () => {
      await center.registerTunnel("test-pkg", mock);
      const tunnel = await center.getTunnel("test-pkg");
      expect(tunnel).toBe(mock);
    });

    it("overwrites existing tunnel with same name", async () => {
      const mock2 = new MockTunnel("second");
      await center.registerTunnel("test-pkg", mock);
      await center.registerTunnel("test-pkg", mock2);
      const tunnel = await center.getTunnel("test-pkg");
      expect(tunnel).toBe(mock2);
      expect(mock2.initCalled).toBe(true);
    });
  });

  describe("closeTunnel", () => {
    it("closes and removes registered tunnel", async () => {
      await center.registerTunnel("test-pkg", mock);
      expect(mock.initCalled).toBe(true);

      await center.closeTunnel("test-pkg");
      expect(mock.closeCalled).toBe(true);
    });

    it("does nothing for non-existent tunnel", async () => {
      await expect(center.closeTunnel("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("rangeTunnel", () => {
    it("iterates over all registered tunnels", async () => {
      const m1 = new MockTunnel("one");
      const m2 = new MockTunnel("two");
      await center.registerTunnel("pkg1", m1);
      await center.registerTunnel("pkg2", m2);

      const names: string[] = [];
      center.rangeTunnel((name) => {
        names.push(name);
        return true; // continue
      });

      expect(names).toContain("pkg1");
      expect(names).toContain("pkg2");
      expect(names.length).toBe(2);
    });

    it("stops iteration when callback returns false", async () => {
      const m1 = new MockTunnel("one");
      const m2 = new MockTunnel("two");
      await center.registerTunnel("pkg1", m1);
      await center.registerTunnel("pkg2", m2);

      const names: string[] = [];
      center.rangeTunnel((name) => {
        names.push(name);
        return false; // stop after first
      });

      expect(names.length).toBe(1);
    });
  });
});