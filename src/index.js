"use strict";

const api = require("./api");
const { toolchain } = require("./toolchain");
const { PackageNotExistError } = require("./remote");
const { AllowedType } = require("./allowed");
const tunnel = require("./tunnel");
const { TunnelCenter, tunnelCenter } = require("./tunnel-center");
const { PackageCenter, packageCenter } = require("./package-center");

module.exports = {
  useWarehouse: api.useWarehouse,
  useNamespace: api.useNamespace,
  useDefaultVersion: api.useDefaultVersion,
  registerPackage: api.registerPackage,
  getPackage: api.getPackage,
  getTunnel: api.getTunnel,
  closePackage: api.closePackage,

  toolchain,
  PackageNotExistError,
  AllowedType,

  Template: tunnel.Template,
  isTunnelNode: tunnel.isTunnelNode,
  callTunnelInit: tunnel.callTunnelInit,
  callTunnelInvoke: tunnel.callTunnelInvoke,
  callTunnelMeta: tunnel.callTunnelMeta,
  callTunnelClose: tunnel.callTunnelClose,

  TunnelCenter,
  tunnelCenter,
  PackageCenter,
  packageCenter,
};
