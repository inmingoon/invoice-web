/**
 * 진단용: stdin 비밀번호를 두 경로로 검증.
 *  1. .env.local 직접 readFile
 *  2. @next/env loadEnvConfig (Next.js dev 서버와 동일 경로)
 * 두 결과를 비교 — 차이가 나면 BOM/dotenv parsing 차이 원인.
 *
 * 사용법: node scripts/verify-password.mjs
 */
import { readFile } from "node:fs/promises";
import { scrypt, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

const scryptAsync = promisify(scrypt);

async function loadFromFile() {
  const content = await readFile(".env.local", "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("ADMIN_PASSWORD_HASH=")) {
      return line.slice("ADMIN_PASSWORD_HASH=".length);
    }
  }
  return null;
}

function loadFromNextEnv() {
  loadEnvConfig(process.cwd(), true);
  return process.env.ADMIN_PASSWORD_HASH ?? null;
}

async function verify(plain, stored) {
  if (!stored) return { ok: false, reason: "no-hash" };
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return { ok: false, reason: `malformed (parts=${parts.length})` };
  }
  const [, N, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(plain, salt, expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  const ok =
    actual.length === expected.length && timingSafeEqual(actual, expected);
  return { ok, reason: ok ? "match" : "mismatch" };
}

const fromFile = await loadFromFile();
const fromNext = loadFromNextEnv();

const rl = createInterface({ input: process.stdin, output: process.stderr });
const rawPlain = await rl.question("비밀번호 입력 (검증용): ");
rl.close();
const plain = rawPlain.replace(/[\r\n]+$/, "");
process.stderr.write(
  `plain bytes: raw=${rawPlain.length}, trimmed=${plain.length}, last char code=${rawPlain.length ? rawPlain.charCodeAt(rawPlain.length - 1) : "n/a"}\n`,
);

const fileResult = await verify(plain, fromFile);
const nextResult = await verify(plain, fromNext);

process.stdout.write(
  JSON.stringify(
    {
      direct_readFile: {
        length: fromFile?.length ?? null,
        prefix: fromFile?.slice(0, 7) ?? null,
        result: fileResult,
      },
      next_env: {
        length: fromNext?.length ?? null,
        prefix: fromNext?.slice(0, 7) ?? null,
        result: nextResult,
      },
      diff: fromFile === fromNext ? "identical" : "DIFFERENT",
      lengthDiff: (fromFile?.length ?? 0) - (fromNext?.length ?? 0),
    },
    null,
    2,
  ) + "\n",
);
