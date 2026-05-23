"use strict";

const { warehouse } = require("./warehouse");
const {
  callTunnelClose,
  callTunnelInit,
  resolveTunnelExport,
} = require("./tunnel");

class TunnelCenter {
  constructor(warehouseImpl = warehouse) {
    this._warehouse = warehouseImpl;
    this._tunnels = new Map();
  }

  async getTunnel(name) {
    if (this._tunnels.has(name)) {
      return this._tunnels.get(name);
    }

    const symbol = await this._warehouse.load(name);
    const tunnel = await resolveTunnelExport(symbol);
    await callTunnelInit(tunnel);
    this._tunnels.set(name, tunnel);
    return tunnel;
  }

  async closeTunnel(name) {
    if (!this._tunnels.has(name)) {
      return;
    }

    const tunnel = this._tunnels.get(name);
    await callTunnelClose(tunnel);
    this._tunnels.delete(name);
  }

  rangeTunnel(fn) {
    for (const [name, tunnel] of this._tunnels.entries()) {
      if (fn(name, tunnel) === false) {
        break;
      }
    }
  }

  async registerTunnel(name, tunnelLike) {
    const tunnel = await resolveTunnelExport(tunnelLike);
    await callTunnelInit(tunnel);
    this._tunnels.set(name, tunnel);
    return tunnel;
  }
}

const tunnelCenter = new TunnelCenter();

module.exports = {
  TunnelCenter,
  tunnelCenter,
};
