import { describe, it, expect } from "vitest";
import { assertSafePublicUrl } from "../urlSafety.js";

describe("assertSafePublicUrl (SSRF Guard)", () => {
  it("rejects loopback and localhost addresses", async () => {
    await expect(assertSafePublicUrl("http://localhost:4000/wp-json")).rejects.toThrow();
    await expect(assertSafePublicUrl("http://127.0.0.1:4000")).rejects.toThrow();
    await expect(assertSafePublicUrl("http://127.0.0.2:80")).rejects.toThrow();
  });

  it("rejects cloud metadata IP 169.254.169.254", async () => {
    await expect(assertSafePublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
    await expect(assertSafePublicUrl("https://169.254.169.254/")).rejects.toThrow();
  });

  it("rejects private RFC-1918 networks", async () => {
    await expect(assertSafePublicUrl("http://10.0.0.1/admin")).rejects.toThrow();
    await expect(assertSafePublicUrl("http://192.168.1.1/setup")).rejects.toThrow();
    await expect(assertSafePublicUrl("http://172.16.0.100/")).rejects.toThrow();
    await expect(assertSafePublicUrl("http://172.31.255.255/")).rejects.toThrow();
  });

  it("rejects non-HTTP protocols", async () => {
    await expect(assertSafePublicUrl("ftp://example.com/test")).rejects.toThrow();
    await expect(assertSafePublicUrl("gopher://example.com/")).rejects.toThrow();
    await expect(assertSafePublicUrl("file:///etc/passwd")).rejects.toThrow();
  });

  it("rejects internal and local TLDs", async () => {
    await expect(assertSafePublicUrl("http://server.local/")).rejects.toThrow();
    await expect(assertSafePublicUrl("http://cluster.internal/")).rejects.toThrow();
  });

  it("accepts valid public HTTPS URLs", async () => {
    const normalized = await assertSafePublicUrl("https://example.com/store");
    expect(normalized).toBe("https://example.com/store");
  });
});
