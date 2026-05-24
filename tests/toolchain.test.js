const { toolchain } = require("../src/toolchain");

describe("toolchain", () => {
  afterEach(() => {
    // Restore env after each test that modifies env vars
    delete process.env.DYNAMIC_OS;
    delete process.env.DYNAMIC_ARCH;
    delete process.env.DYNAMIC_COMPILER;
    delete process.env.DYNAMIC_VARIANT;
    toolchain.setOS("");
    toolchain.setArch("");
    toolchain.setCompiler("");
    toolchain.setVariant("");
  });

  describe("auto-detection", () => {
    it("detects OS (non-empty)", () => {
      const os = toolchain.osName;
      expect(os).toBeTruthy();
      expect(typeof os).toBe("string");
    });

    it("detects Arch (non-empty)", () => {
      const arch = toolchain.arch;
      expect(arch).toBeTruthy();
      expect(typeof arch).toBe("string");
      // Matches dynamic-node-cli env.js getArch(): x64 -> amd64v1, arm64 -> arm64v8.
      expect(["amd64v1", "arm64v8", "386"]).toContain(arch);
    });

    it("detects Compiler (non-empty, starts with 'node')", () => {
      const compiler = toolchain.compiler;
      expect(compiler).toBeTruthy();
      expect(compiler.startsWith("node")).toBe(true);
    });

    it("defaults variant to 'bundle'", () => {
      const variant = toolchain.variant;
      expect(variant).toBe("bundle");
    });

    it("toString() returns os_arch_compiler_variant format", () => {
      const s = toolchain.toString();
      const parts = s.split("_");
      expect(parts.length).toBeGreaterThanOrEqual(4);
      expect(s.endsWith("_bundle")).toBe(true);
    });
  });

  describe("programmatic setter (priority 1)", () => {
    it("setOS overrides auto-detection", () => {
      toolchain.setOS("customlinux1.0");
      expect(toolchain.osName).toBe("customlinux1.0");
    });

    it("setArch overrides auto-detection", () => {
      toolchain.setArch("customarch");
      expect(toolchain.arch).toBe("customarch");
    });

    it("setCompiler overrides auto-detection", () => {
      toolchain.setCompiler("node99.99.9");
      expect(toolchain.compiler).toBe("node99.99.9");
    });

    it("setVariant overrides default", () => {
      toolchain.setVariant("full");
      expect(toolchain.variant).toBe("full");
    });

    it("combined setter produces correct toolchain string", () => {
      toolchain.setOS("ubuntu24.04");
      toolchain.setArch("amd64");
      toolchain.setCompiler("node22.11.0");
      toolchain.setVariant("bundle");
      expect(toolchain.toString()).toBe("ubuntu24.04_amd64_node22.11.0_bundle");
    });
  });

  describe("environment variable override (priority 2)", () => {
    it("DYNAMIC_OS overrides auto-detect", () => {
      process.env.DYNAMIC_OS = "testlinux";
      toolchain.setOS("");
      expect(toolchain.osName).toBe("testlinux");
    });

    it("DYNAMIC_ARCH overrides auto-detect", () => {
      process.env.DYNAMIC_ARCH = "testarch";
      toolchain.setArch("");
      expect(toolchain.arch).toBe("testarch");
    });

    it("DYNAMIC_COMPILER overrides auto-detect", () => {
      process.env.DYNAMIC_COMPILER = "node42.0.0";
      toolchain.setCompiler("");
      expect(toolchain.compiler).toBe("node42.0.0");
    });

    it("DYNAMIC_VARIANT overrides default", () => {
      process.env.DYNAMIC_VARIANT = "full";
      toolchain.setVariant("");
      expect(toolchain.variant).toBe("full");
    });

    it("setter has higher priority than env var", () => {
      process.env.DYNAMIC_OS = "env-os";
      toolchain.setOS("setter-os");
      expect(toolchain.osName).toBe("setter-os");
    });
  });

  describe("isolation between calls", () => {
    it("can change values between calls", () => {
      toolchain.setVariant("bundle");
      expect(toolchain.variant).toBe("bundle");
      expect(toolchain.toString().endsWith("_bundle")).toBe(true);

      toolchain.setVariant("full");
      expect(toolchain.variant).toBe("full");
      expect(toolchain.toString().endsWith("_full")).toBe(true);
    });
  });
});
