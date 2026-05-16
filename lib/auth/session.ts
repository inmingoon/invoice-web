import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "invoice_admin_session";
const ALG = "HS256";
const DURATION_SECONDS = 60 * 60 * 24;

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("SESSION_SECRET missing or < 32 chars");
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

/** admin 세션 JWT 발급. payload는 sub: "admin"만. */
export async function signSession(): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${DURATION_SECONDS}s`)
    .sign(getSecret());
}

/** 토큰 검증. 잘못된 서명·만료·sub 불일치는 모두 false (throw 없음). Edge runtime OK (jose는 Web Crypto 기반). */
export async function verifySession(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    return payload.sub === "admin";
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = DURATION_SECONDS;
