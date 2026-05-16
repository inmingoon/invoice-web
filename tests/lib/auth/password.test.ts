import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes in expected format and round-trips", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter3", hash)).toBe(false);
  });

  it("rejects empty inputs", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("", hash)).toBe(false);
    expect(await verifyPassword("hunter2", "")).toBe(false);
  });

  it("rejects malformed hash", async () => {
    expect(await verifyPassword("hunter2", "not-a-hash")).toBe(false);
    expect(await verifyPassword("hunter2", "scrypt$x$y$z$aa$bb")).toBe(false);
    expect(await verifyPassword("hunter2", "bcrypt$1$2$3$aa$bb")).toBe(false);
  });

  it("throws when hashing empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow("password is empty");
  });
});
