import "server-only";

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

const KEY_LEN = 64;
const PARAMS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

/**
 * 비밀번호 → scrypt 해시. format: `scrypt$N$r$p$saltHex$hashHex`.
 * Edge runtime에서는 동작 안 함 (node:crypto 필요) — Server Action·Route Handler에서만.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error("password is empty");
  const salt = randomBytes(16);
  const derived = (await scryptAsync(plain, salt, KEY_LEN, PARAMS)) as Buffer;
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

/** 저장 해시와 평문을 상수 시간 비교. format 불일치/길이 불일치 시 false. */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  if (!plain || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (expected.length === 0) return false;
  const actual = (await scryptAsync(plain, salt, expected.length, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
