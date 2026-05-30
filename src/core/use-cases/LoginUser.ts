import { IUserRepository } from "../domain/repositories/IUserRepository";
import { User, isUserLocked } from "../domain/entities/User";
import bcrypt from "bcryptjs";

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

    // 1. Check if the account is currently frozen due to repeated failed entry attempts
    if (isUserLocked(user)) {
      const remainingTime = Math.ceil(
        (new Date(user.lockUntil!).getTime() - Date.now()) / 60000
      );
      throw new Error(
        `Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingTime} minute(s).`
      );
    }

    // 2. Verify password using bcrypt comparison
    const isPasswordValid = await bcrypt.compare(plainPassword, user.password);
    if (!isPasswordValid) {
      // Increment login attempts and lock if threshold exceeded (5 failed attempts)
      const attempts = (user.loginAttempts || 0) + 1;
      const updates: Partial<User> = { loginAttempts: attempts };

      if (attempts >= 5) {
        // Freeze account for 15 minutes
        updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.userRepository.update(user.id!, updates);

      throw new Error("Invalid email or password");
    }

    // 3. Reset failed login attempts on successful authentication
    if (user.loginAttempts && user.loginAttempts > 0) {
      await this.userRepository.update(user.id!, {
        loginAttempts: 0,
        lockUntil: undefined,
      });
    }

    // Exclude password in return
    const userResult = { ...user };
    delete userResult.password;
    return userResult;
  }
}
