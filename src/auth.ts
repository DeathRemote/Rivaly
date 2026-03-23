import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
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

type RivalyRole = "USER" | "ADMIN";

type RivalyJWT = JWT & {
  role?: RivalyRole;
  username?: string | null;
  country?: string | null;
};

type RivalySessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: RivalyRole;
  username?: string | null;
  country?: string | null;
};

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
      const t = token as RivalyJWT;

      // Persist user id onto the token on sign-in.
      if (user?.id) t.sub = user.id;

      // Populate extra fields onto the JWT so we can use them in Server Components
      // without extra DB roundtrips.
      if (t.sub && (!t.role || !t.username || !t.country)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: t.sub },
          select: { role: true, username: true, country: true, name: true, email: true, image: true },
        });

        if (dbUser) {
          t.role = dbUser.role as RivalyRole;
          t.username = dbUser.username;
          t.country = dbUser.country;
          // Keep basics in sync as well.
          t.name = dbUser.name ?? t.name;
          t.email = dbUser.email ?? t.email;
          t.picture = dbUser.image ?? t.picture;
        }
      }

      return t;
    },
    async session({ session, token }) {
      const t = token as RivalyJWT;
      if (session.user) {
        const u = session.user as RivalySessionUser;
        u.id = t.sub ?? undefined;
        u.role = t.role;
        u.username = t.username;
        u.country = t.country;
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
      role?: RivalyRole;
      username?: string | null;
      country?: string | null;
    };
  }
}
