import { describe, it, expect } from "vitest";
import { createOriginMatcher, originOf } from "../origins.js";

describe("CORS Origin Validation (origins.ts)", () => {
  it("allows configured explicit origins", () => {
    const matcher = createOriginMatcher({
      explicitOrigins: ["https://example.com", "https://app.example.com/"],
      allowLocalhost: false,
      allowPreviewOrigins: false,
    });

    expect(matcher("https://example.com")).toBe(true);
    expect(matcher("https://app.example.com")).toBe(true);
    expect(matcher("https://evil.com")).toBe(false);
  });

  it("allows official nextdor.online domains and subdomains", () => {
    const matcher = createOriginMatcher({
      explicitOrigins: [],
      allowLocalhost: false,
      allowPreviewOrigins: false,
    });

    expect(matcher("https://nextdor.online")).toBe(true);
    expect(matcher("https://admin.nextdor.online")).toBe(true);
    expect(matcher("https://nextdor.online.attacker.com")).toBe(false);
    expect(matcher("http://nextdor.online")).toBe(false); // Insecure HTTP rejected
  });

  it("respects allowLocalhost setting", () => {
    const devMatcher = createOriginMatcher({
      explicitOrigins: [],
      allowLocalhost: true,
      allowPreviewOrigins: false,
    });
    const prodMatcher = createOriginMatcher({
      explicitOrigins: [],
      allowLocalhost: false,
      allowPreviewOrigins: false,
    });

    expect(devMatcher("http://localhost:3000")).toBe(true);
    expect(devMatcher("http://127.0.0.1:5173")).toBe(true);
    expect(prodMatcher("http://localhost:3000")).toBe(false);
    expect(prodMatcher("http://127.0.0.1:5173")).toBe(false);
  });

  it("respects allowPreviewOrigins setting", () => {
    const devMatcher = createOriginMatcher({
      explicitOrigins: [],
      allowLocalhost: false,
      allowPreviewOrigins: true,
    });
    const prodMatcher = createOriginMatcher({
      explicitOrigins: [],
      allowLocalhost: false,
      allowPreviewOrigins: false,
    });

    expect(devMatcher("https://nextdor-preview.vercel.app")).toBe(true);
    expect(devMatcher("https://nextdor.onrender.com")).toBe(true);
    expect(prodMatcher("https://nextdor-preview.vercel.app")).toBe(false);
  });

  describe("originOf helper", () => {
    it("extracts origin from valid URLs", () => {
      expect(originOf("https://example.com/api/v1?page=1")).toBe("https://example.com");
      expect(originOf("http://localhost:3000/orders")).toBe("http://localhost:3000");
    });

    it("returns null for invalid or non-http URLs", () => {
      expect(originOf("not-a-url")).toBeNull();
      expect(originOf("ftp://ftp.example.com")).toBeNull();
    });
  });
});
