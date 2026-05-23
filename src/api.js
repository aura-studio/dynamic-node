"use strict";

const { allowed } = require("./allowed");
const { warehouse } = require("./warehouse");
const { packageCenter } = require("./package-center");

function useWarehouse(local, remote) {
  if (!local && !remote) {
    return;
  }

  if (local && !remote) {
    if (!allowed.isPath(local)) {
      console.log(`[dynamic] invalid local warehouse path: ${local}`);
      throw new Error("dynamic: invalid local warehouse path");
    }
    warehouse.init(local, "");
    console.log(`[dynamic] use local warehouse: ${local}`);
    return;
  }

  if (local && remote) {
    if (!allowed.isPath(local)) {
      console.log(`[dynamic] invalid local warehouse path: ${local}`);
      throw new Error("dynamic: invalid local warehouse path");
    }
    if (!allowed.isURL(remote)) {
      console.log(`[dynamic] invalid remote warehouse URL: ${remote}`);
      throw new Error("dynamic: invalid remote warehouse URL");
    }
    warehouse.init(local, remote);
    console.log(`[dynamic] use local warehouse: ${local}`);
    console.log(`[dynamic] use remote warehouse: ${remote}`);
    return;
  }

  console.log(
    `[dynamic] invalid warehouse configuration: local=${local}, remote=${remote}`
  );
  throw new Error("dynamic: invalid warehouse configuration");
}

function useNamespace(namespace) {
  if (!allowed.isKeyword(namespace)) {
    throw new Error("dynamic: invalid package namespace");
  }
  packageCenter.useNamespace(namespace);
}

function useDefaultVersion(version) {
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid default package version");
  }
  packageCenter.useDefaultVersion(version);
}

async function registerPackage(pkg, version, tunnel) {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  return packageCenter.registerPackage(pkg, version, tunnel);
}

async function getPackage(pkg, version) {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  return packageCenter.getPackage(pkg, version);
}

async function getTunnel(pkg, version) {
  return getPackage(pkg, version);
}

async function closePackage(pkg, version) {
  if (!allowed.isKeyword(pkg)) {
    throw new Error("dynamic: invalid package name");
  }
  if (!allowed.isKeyword(version)) {
    throw new Error("dynamic: invalid package version");
  }
  await packageCenter.closePackage(pkg, version);
}

module.exports = {
  useWarehouse,
  useNamespace,
  useDefaultVersion,
  registerPackage,
  getPackage,
  getTunnel,
  closePackage,
};
