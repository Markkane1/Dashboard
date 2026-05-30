import { TokenService } from "../../infrastructure/security/TokenService";

export class RevokeRefreshTokenUseCase {
  constructor(private tokenService: TokenService) {}

  async execute(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    await this.tokenService.revokeRefreshToken(refreshToken);
  }
}
