import { IUserRepository } from "../domain/repositories/IUserRepository";
import { User } from "../domain/entities/User";
import crypto from "crypto";

export class LoginUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(email: string, plainPassword?: string): Promise<User> {
    if (!email || !plainPassword) {
      throw new Error("Email and password are required");
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.password) {
      throw new Error("Invalid email or password");
    }

    // Hash plain password to check against stored hash
    const inputHash = crypto.createHash("sha256").update(plainPassword).digest("hex");

    if (inputHash !== user.password) {
      throw new Error("Invalid email or password");
    }

    // Exclude password in return
    const userResult = { ...user };
    delete userResult.password;
    return userResult;
  }
}
