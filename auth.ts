import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { MongoUserRepository } from "@/infrastructure/repositories/MongoUserRepository";
import { LoginUserUseCase } from "@/core/use-cases/LoginUser";
import { UserRole } from "@/core/domain/entities/User";

const userRepository = new MongoUserRepository();
const loginUserUseCase = new LoginUserUseCase(userRepository);

async function findOrCreateOAuthUser(input: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  if (!input.email) {
    return null;
  }

  const existingUser = await userRepository.findByEmail(input.email);
  if (existingUser) {
    return existingUser;
  }

  return userRepository.create({
    name: input.name || input.email.split("@")[0],
    email: input.email,
    password: await bcrypt.hash(crypto.randomUUID(), 12),
    role: "student",
    avatar: input.image || "",
    enrolledCourses: [],
    loginAttempts: 0,
    isVerified: true,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || "elearning-epa-dev-auth-secret-change-me",
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "");
        const password = String(credentials?.password || "");
        const user = await loginUserUseCase.execute(email, password);

        return {
          id: user.id!,
          name: user.name,
          email: user.email,
          image: user.avatar || null,
          role: user.role,
          enrolledCourses: user.enrolledCourses || [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.email) {
        const dbUser =
          account?.provider === "credentials"
            ? await userRepository.findByEmail(user.email)
            : await findOrCreateOAuthUser({
                name: user.name,
                email: user.email,
                image: user.image,
              });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.picture = dbUser.avatar || token.picture;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.enrolledCourses = dbUser.enrolledCourses || [];
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || "");
        session.user.role = (token.role as UserRole) || "student";
        session.user.avatar = typeof token.picture === "string" ? token.picture : "";
        session.user.enrolledCourses = Array.isArray(token.enrolledCourses)
          ? (token.enrolledCourses as string[])
          : [];
      }

      return session;
    },
  },
});
