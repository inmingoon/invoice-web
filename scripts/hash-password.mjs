/** stdin으로 비밀번호 1줄을 받아 scrypt 해시를 stdout으로 출력. .env.local의 ADMIN_PASSWORD_HASH 값으로 사용. 출력은 토큰이 아니라 해시이므로 로깅·복사 가능. */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const rl = createInterface({
  input: process.stdin,
  output: process.stderr,
});
const password = await rl.question("비밀번호 입력: ");
rl.close();

if (!password) {
  console.error("empty password, abort");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scryptAsync(password, salt, KEY_LEN, PARAMS);
process.stdout.write(
  `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("hex")}$${derived.toString("hex")}\n`,
);
