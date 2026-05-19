import { describe, it, expect } from "vitest";
import { Template, Tunnel } from "../src/tunnel";

class MyTunnel extends Template {
  private _meta: string;
  private _invocations: string[] = [];

  constructor(meta: string) {
    super();
    this._meta = meta;
  }

  meta(): string {
    return this._meta;
  }

  async invoke(route: string, req: string): Promise<string> {
    this._invocations.push(`${route}:${req}`);
    return `response-${route}`;
  }
}

describe("Template", () => {
  it("meta() returns empty string by default", () => {
    const t = new Template();
    expect(t.meta()).toBe("");
  });

  it("init() resolves successfully", async () => {
    const t = new Template();
    await expect(t.init()).resolves.toBeUndefined();
  });

  it("invoke() returns empty string by default", async () => {
    const t = new Template();
    expect(await t.invoke("route", "req")).toBe("");
  });

  it("close() resolves successfully", async () => {
    const t = new Template();
    await expect(t.close()).resolves.toBeUndefined();
  });
});

describe("Tunnel (custom implementation)", () => {
  it("allows subclass to override meta()", () => {
    const tunnel = new MyTunnel("my-plugin-v1");
    expect(tunnel.meta()).toBe("my-plugin-v1");
  });

  it("allows subclass to override invoke()", async () => {
    const tunnel = new MyTunnel("test");
    const resp = await tunnel.invoke("hello", '{"key":"val"}');
    expect(resp).toBe("response-hello");
  });

  it("subclass init() and close() are async-safe", async () => {
    const tunnel = new MyTunnel("test");
    await tunnel.init();
    await tunnel.close();
  });
});

describe("Tunnel type compatibility", () => {
  it("Template satisfies Tunnel interface", () => {
    const t: Tunnel = new Template();
    expect(t).toBeDefined();
    expect(typeof t.meta).toBe("function");
    expect(typeof t.init).toBe("function");
    expect(typeof t.invoke).toBe("function");
    expect(typeof t.close).toBe("function");
  });

  it("custom class satisfies Tunnel interface", () => {
    const t: Tunnel = new MyTunnel("t");
    expect(t).toBeDefined();
  });
});