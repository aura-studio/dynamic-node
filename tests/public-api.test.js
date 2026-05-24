const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const dynamic = require("../src");

const EXPECTED_EXPORTS = [
  "AllowedType",
  "Dynamic",
  "DynamicIndex",
  "NAMESPACE_DEFAULT",
  "PackageCenter",
  "PackageNotExistError",
  "Template",
  "Tunnel",
  "TunnelCenter",
  "TunnelNode",
  "VERSION_DEFAULT",
  "VERSION_LATEST",
  "allowed",
  "assertTunnelNode",
  "callTunnelClose",
  "callTunnelInit",
  "callTunnelInvoke",
  "callTunnelMeta",
  "closePackage",
  "getPackage",
  "getTunnel",
  "isPackageNotExist",
  "isTunnelNode",
  "metaToString",
  "packageCenter",
  "registerPackage",
  "toolchain",
  "tunnelCenter",
  "useDefaultVersion",
  "useNamespace",
  "useWarehouse",
];

const touchedExports = new Set();

function api(name) {
  touchedExports.add(name);
  return dynamic[name];
}

function makeTunnel(name = "public") {
  const calls = [];
  return {
    calls,
    init() {
      calls.push("init");
    },
    async invoke(route, request) {
      return JSON.stringify({ name, route, request });
    },
    meta() {
      return { name };
    },
    close() {
      calls.push("close");
    },
  };
}

describe("public API exports", () => {
  afterAll(() => {
    expect([...touchedExports].sort()).toEqual([...EXPECTED_EXPORTS].sort());
  });

  it("exports exactly the documented public surface", () => {
    expect(Object.keys(dynamic).sort()).toEqual([...EXPECTED_EXPORTS].sort());
  });

  it("exercises top-level warehouse/package lifecycle functions", async () => {
    const useWarehouse = api("useWarehouse");
    const useNamespace = api("useNamespace");
    const useDefaultVersion = api("useDefaultVersion");
    const registerPackage = api("registerPackage");
    const getPackage = api("getPackage");
    const getTunnel = api("getTunnel");
    const closePackage = api("closePackage");

    const localWarehouse = path.join(os.tmpdir(), "dynamic-node-public-api");
    fs.mkdirSync(localWarehouse, { recursive: true });

    expect(useWarehouse("", "")).toBeUndefined();
    expect(useWarehouse(localWarehouse, "")).toBeUndefined();
    expect(useNamespace("public-api")).toBeUndefined();
    expect(useDefaultVersion("stable")).toBeUndefined();

    const tunnel = makeTunnel("top-level");
    await registerPackage("pkg", "stable", tunnel);

    const direct = await getPackage("pkg", "stable");
    const fallback = await getTunnel("pkg", "missing");
    expect(direct).toBe(tunnel);
    expect(fallback).toBe(tunnel);
    expect(tunnel.calls).toEqual(["init"]);

    const response = await direct.invoke("/invoke", "body");
    expect(JSON.parse(response)).toEqual({
      name: "top-level",
      route: "/invoke",
      request: "body",
    });

    await closePackage("pkg", "missing");
    await closePackage("pkg", "stable");
    expect(tunnel.calls).toEqual(["init", "close", "close"]);

    useNamespace("default");
    useDefaultVersion("default");
  });

  it("exercises Tunnel classes and helper functions", async () => {
    const Template = api("Template");
    const Tunnel = api("Tunnel");
    const TunnelNode = api("TunnelNode");
    const isTunnelNode = api("isTunnelNode");
    const assertTunnelNode = api("assertTunnelNode");
    const metaToString = api("metaToString");
    const callTunnelInit = api("callTunnelInit");
    const callTunnelInvoke = api("callTunnelInvoke");
    const callTunnelMeta = api("callTunnelMeta");
    const callTunnelClose = api("callTunnelClose");

    expect(Tunnel).toBe(Template);
    expect(TunnelNode).toBe(Template);
    expect(metaToString({ ok: true })).toBe(JSON.stringify({ ok: true }));

    const template = new Template();
    expect(isTunnelNode(template)).toBe(true);
    expect(assertTunnelNode(template)).toBe(template);
    await callTunnelInit(template);
    expect(await callTunnelInvoke(template, "/template", "payload")).toBe("");
    expect(await callTunnelMeta(template)).toBe("");
    await callTunnelClose(template);

    const lower = makeTunnel("lower");
    expect(isTunnelNode(lower)).toBe(true);
    await callTunnelInit(lower);
    expect(await callTunnelInvoke(lower, "/lower", "request")).toBe(
      JSON.stringify({ name: "lower", route: "/lower", request: "request" })
    );
    expect(await callTunnelMeta(lower)).toBe(JSON.stringify({ name: "lower" }));
    await callTunnelClose(lower);
    expect(lower.calls).toEqual(["init", "close"]);

    const upper = {
      Init() {
        this.initialized = true;
      },
      Invoke(route, request) {
        return `${route}:${request}`;
      },
      Meta() {
        return { mode: "upper" };
      },
      Close() {
        this.closed = true;
      },
    };
    expect(isTunnelNode(upper)).toBe(true);
    await callTunnelInit(upper);
    expect(await callTunnelInvoke(upper, "/upper", "payload")).toBe("/upper:payload");
    expect(await callTunnelMeta(upper)).toBe(JSON.stringify({ mode: "upper" }));
    await callTunnelClose(upper);
    expect(upper.initialized).toBe(true);
    expect(upper.closed).toBe(true);

    expect(() => assertTunnelNode({})).toThrow("symbol is not a Tunnel");
  });

  it("exercises allowed, toolchain, Dynamic wrappers, constants, and remote errors", () => {
    const allowed = api("allowed");
    const AllowedType = api("AllowedType");
    const toolchain = api("toolchain");
    const DynamicIndex = api("DynamicIndex");
    const Dynamic = api("Dynamic");
    const PackageNotExistError = api("PackageNotExistError");
    const isPackageNotExist = api("isPackageNotExist");
    const NAMESPACE_DEFAULT = api("NAMESPACE_DEFAULT");
    const VERSION_DEFAULT = api("VERSION_DEFAULT");
    const VERSION_LATEST = api("VERSION_LATEST");

    expect(NAMESPACE_DEFAULT).toBe("default");
    expect(VERSION_DEFAULT).toBe("default");
    expect(VERSION_LATEST).toBe("latest");

    expect(AllowedType.Keyword).toBe(0);
    expect(allowed.match(AllowedType.Keyword, "public-api")).toBe(true);
    expect(allowed.match(AllowedType.Path, "./warehouse")).toBe(true);
    expect(allowed.match(AllowedType.URL, "s3://bucket/prefix")).toBe(true);
    expect(allowed.detect("s3://bucket").type).toBe(AllowedType.URL);

    const previous = {
      osName: toolchain.osName,
      arch: toolchain.arch,
      compiler: toolchain.compiler,
      variant: toolchain.variant,
    };
    try {
      toolchain.setOS("testos");
      toolchain.setArch("testarch");
      toolchain.setCompiler("node-test");
      toolchain.setVariant("bundle");
      expect(toolchain.toString()).toBe("testos_testarch_node-test_bundle");
    } finally {
      toolchain.setOS(previous.osName);
      toolchain.setArch(previous.arch);
      toolchain.setCompiler(previous.compiler);
      toolchain.setVariant(previous.variant);
    }

    const tunnel = makeTunnel("wrapped");
    const index = new DynamicIndex("ns", "pkg", "v1");
    const wrapper = new Dynamic(index, tunnel);
    expect(index.toString()).toBe("ns_pkg_v1");
    expect(wrapper.getTunnel()).toBe(tunnel);

    const err = new PackageNotExistError("missing");
    expect(err.name).toBe("PackageNotExistError");
    expect(isPackageNotExist(err)).toBe(true);
    expect(isPackageNotExist(new Error("missing"))).toBe(false);
  });

  it("exercises exported TunnelCenter and PackageCenter classes and singletons", async () => {
    const TunnelCenter = api("TunnelCenter");
    const tunnelCenter = api("tunnelCenter");
    const PackageCenter = api("PackageCenter");
    const packageCenter = api("packageCenter");

    expect(tunnelCenter).toBeInstanceOf(TunnelCenter);
    expect(packageCenter).toBeInstanceOf(PackageCenter);

    const loadedTunnel = makeTunnel("loaded");
    const center = new TunnelCenter({
      async load(name) {
        expect(name).toBe("ns_loaded_v1");
        return { Tunnel: loadedTunnel };
      },
    });

    const loaded = await center.getTunnel("ns_loaded_v1");
    expect(loaded).toBe(loadedTunnel);
    const ranged = [];
    center.rangeTunnel((name, tunnel) => {
      ranged.push([name, tunnel]);
      return true;
    });
    expect(ranged).toEqual([["ns_loaded_v1", loadedTunnel]]);
    await center.closeTunnel("ns_loaded_v1");
    expect(loadedTunnel.calls).toEqual(["init", "close"]);

    const registeredTunnel = makeTunnel("registered");
    await center.registerTunnel("ns_registered_v1", registeredTunnel);
    expect(await center.getTunnel("ns_registered_v1")).toBe(registeredTunnel);
    await center.closeTunnel("ns_registered_v1");

    const packageOnlyTunnel = makeTunnel("package-center");
    const pkgCenter = new PackageCenter(new TunnelCenter({
      async load() {
        throw new Error("dynamic: warehouse package not exists");
      },
    }));
    pkgCenter.useNamespace("ns");
    pkgCenter.useDefaultVersion("default");
    await pkgCenter.registerPackage("pkg", "default", packageOnlyTunnel);

    expect(await pkgCenter.getPackage("pkg", "missing")).toBe(packageOnlyTunnel);
    expect(await pkgCenter.getTunnel("pkg", "default")).toBe(packageOnlyTunnel);
    await pkgCenter.closePackage("pkg", "missing");
    await pkgCenter.closePackage("pkg", "default");
    expect(packageOnlyTunnel.calls).toEqual(["init", "close", "close"]);
  });
});
