"use strict";

const TUNNEL_NODE_BRAND = Symbol.for("aura-studio.tunnel-node");

class Template {
  constructor() {
    Object.defineProperty(this, TUNNEL_NODE_BRAND, {
      value: true,
      enumerable: false,
    });
  }

  async init() {}

  async invoke(_route, _request) {
    return "";
  }

  async meta() {
    return "";
  }

  async close() {}

  Init() {
    return this.init();
  }

  Invoke(route, request) {
    return this.invoke(route, request);
  }

  Meta() {
    return this.meta();
  }

  Close() {
    return this.close();
  }
}

function hasMethod(value, name) {
  return value && typeof value[name] === "function";
}

function isTunnelNode(value) {
  if (!value) return false;
  if (value[TUNNEL_NODE_BRAND] === true) return true;

  const lower =
    hasMethod(value, "init") &&
    hasMethod(value, "invoke") &&
    hasMethod(value, "meta") &&
    hasMethod(value, "close");
  const upper =
    hasMethod(value, "Init") &&
    hasMethod(value, "Invoke") &&
    hasMethod(value, "Meta") &&
    hasMethod(value, "Close");

  return lower || upper;
}

function assertTunnelNode(value) {
  if (!isTunnelNode(value)) {
    throw new TypeError("dynamic: symbol is not a Tunnel");
  }
  return value;
}

function metaToString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function callTunnelInit(tunnel) {
  assertTunnelNode(tunnel);
  if (hasMethod(tunnel, "init")) return tunnel.init();
  return tunnel.Init();
}

async function callTunnelInvoke(tunnel, route, request) {
  assertTunnelNode(tunnel);
  if (hasMethod(tunnel, "invoke")) return tunnel.invoke(route, request);
  return tunnel.Invoke(route, request);
}

async function callTunnelMeta(tunnel) {
  assertTunnelNode(tunnel);
  const result = hasMethod(tunnel, "meta")
    ? await tunnel.meta()
    : await tunnel.Meta();
  return metaToString(result);
}

async function callTunnelClose(tunnel) {
  assertTunnelNode(tunnel);
  if (hasMethod(tunnel, "close")) return tunnel.close();
  return tunnel.Close();
}

async function resolveTunnelExport(value) {
  if (isTunnelNode(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    if (value.Tunnel != null) {
      return assertTunnelNode(value.Tunnel);
    }

    if (typeof value.New === "function") {
      return assertTunnelNode(await value.New());
    }

    if (value.default != null) {
      return resolveTunnelExport(value.default);
    }
  }

  throw new TypeError("dynamic: symbol is not a Tunnel");
}

module.exports = {
  Template,
  Tunnel: Template,
  TunnelNode: Template,
  TUNNEL_NODE_BRAND,
  isTunnelNode,
  assertTunnelNode,
  metaToString,
  callTunnelInit,
  callTunnelInvoke,
  callTunnelMeta,
  callTunnelClose,
  resolveTunnelExport,
};
