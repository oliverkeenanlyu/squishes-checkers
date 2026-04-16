import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
  allowedEmails,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    // Only include email provider if SMTP is configured
    ...(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM
      ? [EmailProvider({
          server: {
            host: env.SMTP_HOST,
            port: Number(env.SMTP_PORT),
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            },
          },
          from: env.EMAIL_FROM,
          maxAge: 24 * 60 * 60, // 24 hours
        })]
      : []
    ),
    /**
     * For development/testing, you can also add Discord provider:
     * DiscordProvider,
     */
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    async signIn({ user, email: _email }) {
      if (!user.email) return false;
      
      // Check if email is in the allowed emails list
      const allowedEmail = await db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, user.email))
        .limit(1);
      
      return allowedEmail.length > 0;
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
} satisfies NextAuthConfig;
