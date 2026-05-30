import crypto from "crypto";
import { dbConnect } from "../database/mongodb";
import { RefreshTokenModel } from "../database/models/RefreshTokenModel";

export const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const REFRESH_TOKEN_EXPIRES_MS = REFRESH_TOKEN_MAX_AGE_SECONDS * 1000;

const JWT_SECRET = process.env.JWT_SECRET || "elearning_epa_super_secret_key_123_abc";

function base64url(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export interface UserTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export class TokenService {
  /**
   * Generates a stateless JWT access token valid for 15 minutes.
   */
  generateAccessToken(payload: UserTokenPayload): string {
    const header = { alg: "HS256", typ: "JWT" };
    const expiresInSeconds = 15 * 60; // 15 minutes
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(fullPayload));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(signatureInput)
      .digest();

    const encodedSignature = base64url(signature);
    return `${signatureInput}.${encodedSignature}`;
  }

  /**
   * Verifies a stateless JWT access token.
   */
  verifyAccessToken(token: string): UserTokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, encodedSignature] = parts;
      const signatureInput = `${encodedHeader}.${encodedPayload}`;

      const signature = crypto
        .createHmac("sha256", JWT_SECRET)
        .update(signatureInput)
        .digest();

      const expectedSignature = base64url(signature);
      const receivedSignatureBuffer = Buffer.from(encodedSignature, "utf8");
      const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

      if (
        receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
        !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
      ) {
        return null;
      }

      const header = JSON.parse(base64urlDecode(encodedHeader));
      if (header.alg !== "HS256" || header.typ !== "JWT") {
        return null;
      }

      const payload = JSON.parse(base64urlDecode(encodedPayload));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return null; // Expired
      }

      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generates a long-lived random refresh token string.
   */
  generateRefreshTokenString(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /**
   * Persists a refresh token inside MongoDB.
   */
  async saveRefreshToken(userId: string, token: string): Promise<void> {
    await dbConnect();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);
    await RefreshTokenModel.create({
      userId,
      token,
      revoked: false,
      expiresAt,
    });
  }

  /**
   * Verifies if a refresh token is valid (exists, not expired, and not revoked).
   */
  async verifyRefreshToken(token: string): Promise<string | null> {
    await dbConnect();
    const doc = await RefreshTokenModel.findOne({ token }).exec();
    if (!doc) return null;
    if (doc.revoked || doc.expiresAt.getTime() < Date.now()) {
      return null; // Revoked or expired
    }
    return doc.userId;
  }

  /**
   * Revokes a refresh token in MongoDB.
   */
  async revokeRefreshToken(token: string): Promise<void> {
    await dbConnect();
    await RefreshTokenModel.findOneAndUpdate({ token }, { revoked: true }).exec();
  }
}
