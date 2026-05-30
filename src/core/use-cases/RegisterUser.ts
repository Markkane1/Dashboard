import { IUserRepository } from "../domain/repositories/IUserRepository";
import { User } from "../domain/entities/User";
import bcrypt from "bcryptjs";

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

    // Securely hash password using bcrypt with 12 salt rounds
    const hashedPassword = await bcrypt.hash(input.password, 12);

    const createdUser = await this.userRepository.create({
      ...input,
      password: hashedPassword,
      loginAttempts: 0,
      isVerified: false, // verification defaults to false until authenticated or validated
    });

    // Make sure we never leak the password in the domain entity output
    const userResult = { ...createdUser };
    delete userResult.password;
    return userResult;
  }
}
