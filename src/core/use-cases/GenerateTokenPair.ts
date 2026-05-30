import { TokenService, UserTokenPayload } from "../../infrastructure/security/TokenService";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class GenerateTokenPairUseCase {
  constructor(private tokenService: TokenService) {}

  async execute(payload: UserTokenPayload): Promise<TokenPair> {
    if (!payload.userId || !payload.email || !payload.role) {
      throw new Error("Invalid payload context for token generation");
    }

    // 1. Generate Access Token (15-min JWT)
    const accessToken = this.tokenService.generateAccessToken(payload);

    // 2. Generate Refresh Token (cryptographically secure string)
    const refreshToken = this.tokenService.generateRefreshTokenString();

    // 3. Persist Refresh Token inside database (7 days expiration TTL)
    await this.tokenService.saveRefreshToken(payload.userId, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }
}
