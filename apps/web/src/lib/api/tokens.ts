import { createHash, randomBytes } from "crypto";

const TOKEN_PREFIX = "jbcn_";

export function generateToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return {
    plaintext,
    hash: hashToken(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
