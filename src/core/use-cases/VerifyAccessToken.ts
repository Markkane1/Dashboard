import { TokenService, UserTokenPayload } from "../../infrastructure/security/TokenService";

export class VerifyAccessTokenUseCase {
  constructor(private tokenService: TokenService) {}

  execute(token: string): UserTokenPayload | null {
    if (!token) {
      throw new Error("Access token is required");
    }

    return this.tokenService.verifyAccessToken(token);
  }
}
