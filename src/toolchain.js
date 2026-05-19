/**
 * toolchain.js — Toolchain singleton
 *
 * Detects OS, Arch, Compiler (Node.js version), and Variant.
 * Assembles them into a toolchain string: <os>_<arch>_<compiler>_<variant>
 *
 * Priority:
 *   1. Programmatic setter (setOS / setArch / setCompiler / setVariant)
 *   2. Environment variables (DYNAMIC_OS / DYNAMIC_ARCH / DYNAMIC_COMPILER / DYNAMIC_VARIANT)
 *   3. Runtime auto-detection
 */

"use strict";

const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// Auto-detection helpers
// ---------------------------------------------------------------------------

function detectOS() {
  const platform = os.platform();

  switch (platform) {
    case "linux":
      return detectLinuxDescriptor() || "linux";
    case "darwin":
      return "darwin" + (detectDarwinVersion() || "");
    case "win32":
      return "windows" + (detectWindowsVersion() || "");
    default:
      return platform;
  }
}

function detectLinuxDescriptor() {
  try {
    const content = fs.readFileSync("/etc/os-release", "utf-8");
    const m = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx);
      let value = trimmed.slice(idx + 1);
      value = value.replace(/^"|"$/g, "");
      m[key] = value;
    }
    const id = (m["ID"] || "").toLowerCase().trim();
    const ver = (m["VERSION_ID"] || "").trim();
    if (id && ver) return id + ver;
    return "";
  } catch {
    return "";
  }
}

function detectDarwinVersion() {
  try {
    const ver = execSync("sw_vers -productVersion", { encoding: "utf-8" }).trim();
    return ver || "";
  } catch {
    try {
      const ver = execSync("uname -r", { encoding: "utf-8" }).trim();
      return ver || "";
    } catch {
      return "";
    }
  }
}

function detectWindowsVersion() {
  try {
    const ver = os.version(); // e.g. "Windows 10 Pro"
    const match = ver.match(/[\d]+(?:\.[\d]+)*/);
    return match ? match[0] : "";
  } catch {
    return "";
  }
}

function detectArch() {
  const arch = os.arch();
  switch (arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    case "arm":
      return "arm";
    case "ia32":
      return "386";
    default:
      return arch;
  }
}

function detectCompiler() {
  // process.version is "v22.11.0", we want "node22.11.0"
  const ver = process.version.replace(/^v/, "");
  return "node" + ver;
}

// ---------------------------------------------------------------------------
// Toolchain class
// ---------------------------------------------------------------------------

class Toolchain {
  constructor() {
    this._os = "";
    this._arch = "";
    this._compiler = "";
    this._variant = "";
    this._initialized = false;
  }

  _ensureInit() {
    if (this._initialized) return;
    this._initialized = true;

    // OS: setter > env > auto-detect
    if (!this._os) {
      this._os = process.env.DYNAMIC_OS || "";
    }
    if (!this._os) {
      this._os = detectOS();
    }

    // Arch: setter > env > auto-detect
    if (!this._arch) {
      this._arch = process.env.DYNAMIC_ARCH || "";
    }
    if (!this._arch) {
      this._arch = detectArch();
    }

    // Compiler: setter > env > auto-detect
    if (!this._compiler) {
      this._compiler = process.env.DYNAMIC_COMPILER || "";
    }
    if (!this._compiler) {
      this._compiler = detectCompiler();
    }

    // Variant: setter > env > default "bundle"
    if (!this._variant) {
      this._variant = process.env.DYNAMIC_VARIANT || "";
    }
    if (!this._variant) {
      this._variant = "bundle";
    }
  }

  // Setters (priority 1)
  setOS(value) {
    this._os = value;
    this._initialized = false;
  }

  setArch(value) {
    this._arch = value;
    this._initialized = false;
  }

  setCompiler(value) {
    this._compiler = value;
    this._initialized = false;
  }

  setVariant(value) {
    this._variant = value;
    this._initialized = false;
  }

  // Getters
  get osName() {
    this._ensureInit();
    return this._os;
  }

  get arch() {
    this._ensureInit();
    return this._arch;
  }

  get compiler() {
    this._ensureInit();
    return this._compiler;
  }

  get variant() {
    this._ensureInit();
    return this._variant;
  }

  /**
   * Returns the toolchain string: <os>_<arch>_<compiler>_<variant>
   */
  toString() {
    this._ensureInit();
    return `${this._os}_${this._arch}_${this._compiler}_${this._variant}`;
  }
}

/** Module-level singleton */
const toolchain = new Toolchain();

module.exports = { toolchain };
