import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // 毎回アカウント選択画面を表示する。
      // 未指定だと Google は前回ログインしたアカウントで自動ログインするため、
      // ログアウト後に別アカウントを選び直せなくなる。
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: { ...session.user, id: user.id },
    }),
  },
  pages: { signIn: "/login" },
});
