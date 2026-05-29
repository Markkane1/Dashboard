import { IUserRepository } from "../domain/repositories/IUserRepository";
import { User } from "../domain/entities/User";
import crypto from "crypto";

export class RegisterUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    if (!input.email || !input.password || !input.name) {
      throw new Error("Missing required registration fields");
    }

    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new Error("An account with this email address already exists");
    }

    // Securely hash password using Node's built-in crypto module
    const hashedPassword = crypto.createHash("sha256").update(input.password).digest("hex");

    const createdUser = await this.userRepository.create({
      ...input,
      password: hashedPassword,
    });

    // Make sure we never leak the password in the domain entity output
    const userResult = { ...createdUser };
    delete userResult.password;
    return userResult;
  }
}
