import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  TokenService,
  UserTokenPayload,
} from "./TokenService";

export type AuthorizationResult =
  | { success: true; user: UserTokenPayload }
  | NextResponse;

function getCookieValue(request: Request | NextRequest, name: string): string | undefined {
  if (typeof (request as any).cookies?.get === "function") {
    return (request as any).cookies.get(name)?.value;
  }
  return undefined;
}

function buildErrorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      status: status,
    },
    { status }
  );
}

export function enforcePermissions(...allowedRoles: string[]) {
  return (
    request: Request | NextRequest,
    tokenService: TokenService
  ): AuthorizationResult => {
    const accessToken = getCookieValue(request, ACCESS_TOKEN_COOKIE_NAME);
    if (!accessToken) {
      return buildErrorResponse("Authentication required", 401);
    }

    const userPayload = tokenService.verifyAccessToken(accessToken);
    if (!userPayload) {
      return buildErrorResponse("Authentication required or token invalid", 401);
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userPayload.role)) {
      return buildErrorResponse("Forbidden: insufficient permissions", 403);
    }

    return { success: true, user: userPayload };
  };
}

export function withAuthorization(
  handler: (request: Request | NextRequest, user: UserTokenPayload) => Response | Promise<Response>,
  ...allowedRoles: string[]
) {
  const tokenService = new TokenService();

  return async (request: Request | NextRequest) => {
    const authorization = enforcePermissions(...allowedRoles)(request, tokenService);
    if (!(authorization as any).success) {
      return authorization as NextResponse;
    }
    return handler(request, authorization.user);
  };
}
