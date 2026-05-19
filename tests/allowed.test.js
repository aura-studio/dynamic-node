const { allowed, AllowedType } = require("../src/allowed");

describe("allowed", () => {
  describe("isKeyword", () => {
    it("accepts valid lowercase keywords", () => {
      expect(allowed.isKeyword("myapp")).toBe(true);
      expect(allowed.isKeyword("my-app")).toBe(true);
      expect(allowed.isKeyword("v1")).toBe(true);
      expect(allowed.isKeyword("default")).toBe(true);
      expect(allowed.isKeyword("scp")).toBe(true);
      expect(allowed.isKeyword("a")).toBe(true);
      expect(allowed.isKeyword("a1-b2-c3")).toBe(true);
    });

    it("rejects uppercase characters", () => {
      expect(allowed.isKeyword("MyApp")).toBe(false);
      expect(allowed.isKeyword("SCP")).toBe(false);
    });

    it("rejects special characters", () => {
      expect(allowed.isKeyword("my_app")).toBe(false);
      expect(allowed.isKeyword("my.app")).toBe(false);
      expect(allowed.isKeyword("my@pp")).toBe(false);
      expect(allowed.isKeyword("my app")).toBe(false);
    });

    it("rejects leading hyphen", () => {
      expect(allowed.isKeyword("-myapp")).toBe(false);
    });

    it("rejects leading digit-only followed by special char", () => {
      expect(allowed.isKeyword("1_myapp")).toBe(false);
    });

    it("accepts digit-only start with proper chars", () => {
      expect(allowed.isKeyword("1myapp")).toBe(true);
    });

    it("rejects empty string", () => {
      expect(allowed.isKeyword("")).toBe(false);
    });
  });

  describe("isPath", () => {
    it("accepts absolute Unix paths", () => {
      expect(allowed.isPath("/opt/warehouse")).toBe(true);
      expect(allowed.isPath("/tmp")).toBe(true);
    });

    it("accepts relative Unix paths", () => {
      expect(allowed.isPath("./local")).toBe(true);
      expect(allowed.isPath("../parent")).toBe(true);
    });

    it("accepts Windows drive paths", () => {
      expect(allowed.isPath("C:\\Users\\test")).toBe(true);
      expect(allowed.isPath("D:/data")).toBe(true);
    });

    it("accepts UNC paths", () => {
      expect(allowed.isPath("\\\\server\\share")).toBe(true);
    });

    it("rejects empty path", () => {
      expect(allowed.isPath("")).toBe(true);
    });
  });

  describe("isURL", () => {
    it("accepts s3:// URLs", () => {
      expect(allowed.isURL("s3://mirroring-lambda")).toBe(true);
      expect(allowed.isURL("s3://dynamic-loader-code-255491288557")).toBe(true);
    });

    it("accepts https:// URLs", () => {
      expect(allowed.isURL("https://example.com")).toBe(true);
      expect(allowed.isURL("https://s3.us-west-1.amazonaws.com")).toBe(true);
    });

    it("accepts file:// URLs", () => {
      expect(allowed.isURL("file:///tmp/warehouse")).toBe(true);
    });

    it("rejects malformed URLs", () => {
      expect(allowed.isURL("not-a-url")).toBe(false);
      expect(allowed.isURL("s3:/missing-slash")).toBe(false);
    });

    it("allows empty URL", () => {
      expect(allowed.isURL("")).toBe(true);
    });
  });

  describe("detect", () => {
    it("detects URL type", () => {
      const result = allowed.detect("s3://bucket");
      expect(result.matched).toBe(true);
      expect(result.type).toBe(AllowedType.URL);
    });

    it("detects Path type", () => {
      const result = allowed.detect("/opt/warehouse");
      expect(result.matched).toBe(true);
      expect(result.type).toBe(AllowedType.Path);
    });

    it("detects Keyword type", () => {
      const result = allowed.detect("myapp");
      expect(result.matched).toBe(true);
      expect(result.type).toBe(AllowedType.Keyword);
    });

    it("URL takes priority over Path", () => {
      const result = allowed.detect("s3://bucket");
      expect(result.type).toBe(AllowedType.URL);
    });

    it("returns unmatched for unrecognized input", () => {
      const result = allowed.detect("@#$%");
      expect(result.matched).toBe(false);
    });
  });

  describe("match (edge cases)", () => {
    it("handles unknown AllowedType gracefully", () => {
      expect(allowed.match(999, "test")).toBe(false);
    });
  });
});
