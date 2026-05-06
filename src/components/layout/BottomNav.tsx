"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { Clock, Home, ListChecks, Settings, ShoppingCart } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { href: "/", label: "ホーム", icon: Home, isActive: (p) => p === "/" },
  {
    href: "/history",
    label: "履歴",
    icon: Clock,
    isActive: (p) => p === "/history",
  },
  {
    href: "/lists",
    label: "リスト",
    icon: ShoppingCart,
    isActive: (p) => p === "/lists" || p.startsWith("/lists/"),
  },
  {
    href: "/sets",
    label: "セット",
    icon: ListChecks,
    isActive: (p) => p === "/sets" || p.startsWith("/sets/"),
  },
  {
    href: "/settings",
    label: "設定",
    icon: Settings,
    isActive: (p) => p === "/settings",
  },
];

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインナビゲーション"
      className="z-20 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition active:bg-gray-50 ${
              active ? "text-gray-900" : "text-gray-500"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-gray-900"
              />
            )}
            <Icon
              className="h-6 w-6"
              strokeWidth={active ? 2.5 : 2}
              aria-hidden
            />
            <span
              className={`text-xs ${active ? "font-bold" : "font-medium"}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
});

BottomNav.displayName = "BottomNav";
