"use strict";

const api = require("./api");
const { toolchain } = require("./toolchain");
const { PackageNotExistError, isPackageNotExist } = require("./remote");
const { allowed, AllowedType } = require("./allowed");
const tunnel = require("./tunnel");
const { TunnelCenter, tunnelCenter } = require("./tunnel-center");
const {
  Dynamic,
  DynamicIndex,
  NAMESPACE_DEFAULT,
  PackageCenter,
  VERSION_DEFAULT,
  VERSION_LATEST,
  packageCenter,
} = require("./package-center");

module.exports = {
  useWarehouse: api.useWarehouse,
  useNamespace: api.useNamespace,
  useDefaultVersion: api.useDefaultVersion,
  registerPackage: api.registerPackage,
  getPackage: api.getPackage,
  getTunnel: api.getTunnel,
  closePackage: api.closePackage,

  UseWarehouse: api.useWarehouse,
  UseNamespace: api.useNamespace,
  UseDefaultVersion: api.useDefaultVersion,
  RegisterPackage: api.registerPackage,
  GetPackage: api.getPackage,
  GetTunnel: api.getTunnel,
  ClosePackage: api.closePackage,

  toolchain,
  PackageNotExistError,
  isPackageNotExist,
  allowed,
  AllowedType,

  Template: tunnel.Template,
  Tunnel: tunnel.Tunnel,
  TunnelNode: tunnel.TunnelNode,
  isTunnelNode: tunnel.isTunnelNode,
  assertTunnelNode: tunnel.assertTunnelNode,
  callTunnelInit: tunnel.callTunnelInit,
  callTunnelInvoke: tunnel.callTunnelInvoke,
  callTunnelMeta: tunnel.callTunnelMeta,
  callTunnelClose: tunnel.callTunnelClose,
  resolveTunnelExport: tunnel.resolveTunnelExport,

  TunnelCenter,
  tunnelCenter,
  Dynamic,
  DynamicIndex,
  PackageCenter,
  packageCenter,
  NAMESPACE_DEFAULT,
  VERSION_DEFAULT,
  VERSION_LATEST,
};
