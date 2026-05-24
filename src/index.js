"use strict";

const api = require("./api");
const { toolchain } = require("./toolchain");
const { PackageNotExistError, isPackageNotExist } = require("./remote");
const { allowed, AllowedType } = require("./allowed");
const tunnel = require("./tunnel");
const { TunnelCenter, tunnelCenter } = require("./tunnel-center");
const {
  NAMESPACE_DEFAULT,
  VERSION_DEFAULT,
  VERSION_LATEST,
  DynamicIndex,
  Dynamic,
  PackageCenter,
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

  toolchain,
  allowed,
  PackageNotExistError,
  isPackageNotExist,
  AllowedType,

  Template: tunnel.Template,
  Tunnel: tunnel.Tunnel,
  TunnelNode: tunnel.TunnelNode,
  isTunnelNode: tunnel.isTunnelNode,
  assertTunnelNode: tunnel.assertTunnelNode,
  metaToString: tunnel.metaToString,
  callTunnelInit: tunnel.callTunnelInit,
  callTunnelInvoke: tunnel.callTunnelInvoke,
  callTunnelMeta: tunnel.callTunnelMeta,
  callTunnelClose: tunnel.callTunnelClose,

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
