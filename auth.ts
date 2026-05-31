import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authenticateUser, findUserByEmail, saveUser, StoredUser } from "@/features/users/data/userDb";
import { env } from "@/env";
import { signApiAccessToken } from "@/shared/auth/apiToken";

async function findOrCreateOAuthUser(input: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  if (!input.email) {
    return null;
  }

  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    return existingUser;
  }

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    name: input.name || input.email.split("@")[0],
    email: input.email.toLowerCase().trim(),
    password: await bcrypt.hash(crypto.randomUUID(), 12),
    role: "student",
    avatar: input.image || "",
    enrolledCourses: [],
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  await saveUser(newUser);
  return newUser;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  pages: {
    signIn: "/auth/login",
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
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");

        const user = await authenticateUser(email, password);
        if (!user) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar || null,
          role: user.role as any,
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
            ? await findUserByEmail(user.email)
            : await findOrCreateOAuthUser({
                name: user.name,
                email: user.email,
                image: user.image,
              });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role as any;
          token.picture = dbUser.avatar || token.picture;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.enrolledCourses = dbUser.enrolledCourses || [];
          token.completedCourses = dbUser.completedCourses || [];
        }
      }

      if (token.id && token.email) {
        token.apiAccessToken = signApiAccessToken({
          id: String(token.id),
          email: String(token.email),
          role: typeof token.role === "string" ? token.role : "student",
          enrolledCourses: Array.isArray(token.enrolledCourses) ? (token.enrolledCourses as string[]) : [],
          completedCourses: Array.isArray(token.completedCourses) ? (token.completedCourses as string[]) : [],
        }, "5m");
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || "");
        session.user.role = (token.role as any) || "student";
        session.user.avatar = typeof token.picture === "string" ? token.picture : "";
        session.user.enrolledCourses = Array.isArray(token.enrolledCourses)
          ? (token.enrolledCourses as string[])
          : [];
      }
      session.apiAccessToken = typeof token.apiAccessToken === "string" ? token.apiAccessToken : undefined;

      return session;
    },
  },
});
