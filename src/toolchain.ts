/**
 * toolchain.ts — Toolchain singleton (counterpart of Go toolchain.go + env.go)
 *
 * Detects OS, Arch, Compiler (Node.js version), and Variant.
 * Assembles them into a toolchain string: <os>_<arch>_<compiler>_<variant>
 *
 * Priority (same as Go):
 *   1. Programmatic setter (setOS / setArch / setCompiler / setVariant)
 *   2. Environment variables (DYNAMIC_OS / DYNAMIC_ARCH / DYNAMIC_COMPILER / DYNAMIC_VARIANT)
 *   3. Runtime auto-detection
 */

import * as os from "os";
import * as fs from "fs";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Auto-detection helpers (counterpart of Go env.go)
// ---------------------------------------------------------------------------

function detectOS(): string {
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

function detectLinuxDescriptor(): string {
  try {
    const content = fs.readFileSync("/etc/os-release", "utf-8");
    const m: Record<string, string> = {};
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

function detectDarwinVersion(): string {
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

function detectWindowsVersion(): string {
  try {
    const ver = os.version(); // e.g. "Windows 10 Pro"
    // Extract version-like token
    const match = ver.match(/[\d]+(?:\.[\d]+)*/);
    return match ? match[0] : "";
  } catch {
    return "";
  }
}

function detectArch(): string {
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

function detectCompiler(): string {
  // process.version is "v22.11.0", we want "node22.11.0"
  const ver = process.version.replace(/^v/, "");
  return "node" + ver;
}

// ---------------------------------------------------------------------------
// Toolchain class
// ---------------------------------------------------------------------------

class Toolchain {
  private _os: string = "";
  private _arch: string = "";
  private _compiler: string = "";
  private _variant: string = "";
  private _initialized = false;

  private ensureInit(): void {
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

  // Setters (priority 1 — counterpart of Go build-time ldflags injection)
  setOS(value: string): void {
    this._os = value;
    this._initialized = false;
  }

  setArch(value: string): void {
    this._arch = value;
    this._initialized = false;
  }

  setCompiler(value: string): void {
    this._compiler = value;
    this._initialized = false;
  }

  setVariant(value: string): void {
    this._variant = value;
    this._initialized = false;
  }

  // Getters
  get osName(): string {
    this.ensureInit();
    return this._os;
  }

  get arch(): string {
    this.ensureInit();
    return this._arch;
  }

  get compiler(): string {
    this.ensureInit();
    return this._compiler;
  }

  get variant(): string {
    this.ensureInit();
    return this._variant;
  }

  /**
   * Returns the toolchain string: <os>_<arch>_<compiler>_<variant>
   * e.g. "ubuntu24.04_amd64_node22.11.0_bundle"
   */
  toString(): string {
    this.ensureInit();
    return `${this._os}_${this._arch}_${this._compiler}_${this._variant}`;
  }
}

/** Module-level singleton (counterpart of Go `var toolchain = NewToolchain()`) */
export const toolchain = new Toolchain();
