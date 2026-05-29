import { TokenService } from "../../infrastructure/security/TokenService";

export class VerifyRefreshTokenUseCase {
  constructor(private tokenService: TokenService) {}

  async execute(refreshToken: string): Promise<string> {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    const userId = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!userId) {
      throw new Error("Refresh token is invalid, revoked, or expired");
    }

    return userId;
  }
}
