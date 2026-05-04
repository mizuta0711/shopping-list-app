"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { memo, type ReactNode } from "react";

type Props = { children: ReactNode };

export const SessionProvider = memo<Props>(function SessionProvider({
  children,
}) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
});

SessionProvider.displayName = "SessionProvider";
