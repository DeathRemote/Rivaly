import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // In serverless environments (Vercel), JWT sessions avoid extra DB writes/reads.
  // We still use the PrismaAdapter to persist Users + Accounts.
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Recommended for Vercel/Edge to avoid issues behind proxies.
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { password: true },
        });

        if (!user?.password?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.password.passwordHash);
        if (!ok) return null;

        // NextAuth expects a minimal user object.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist user id onto the token on sign-in.
      if (user?.id) token.sub = user.id;

      // Populate extra fields onto the JWT so we can use them in Server Components
      // without extra DB roundtrips.
      if (token.sub && (!token.role || !token.username || !token.country)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, username: true, country: true, name: true, email: true, image: true },
        });

        if (dbUser) {
          (token as any).role = dbUser.role;
          (token as any).username = dbUser.username;
          (token as any).country = dbUser.country;
          // Keep basics in sync as well.
          token.name = dbUser.name ?? token.name;
          token.email = dbUser.email ?? token.email;
          token.picture = dbUser.image ?? token.picture;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub ?? undefined;
        (session.user as any).role = (token as any).role;
        (session.user as any).username = (token as any).username;
        (session.user as any).country = (token as any).country;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Ensure we have a DB record (and keep basics synced) for OAuth sign-ins.
      // With PrismaAdapter this usually already exists, but this is idempotent.
      if (!user.email) return;

      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          name: user.name,
          image: user.image,
        },
        update: {
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        },
      });
    },
  },
});

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "USER" | "ADMIN";
      username?: string | null;
      country?: string | null;
    };
  }
}
