"use client";

import Link from "next/link";

const links = [
  { href: "/", label: "Chat", key: "chat" },
  { href: "/games", label: "Games", key: "games" },
  { href: "/markets", label: "Markets", key: "markets" },
] as const;

type NavKey = (typeof links)[number]["key"];

export function AppNav({
  active,
  currentLabel,
}: {
  active: NavKey;
  currentLabel?: string;
}) {
  return (
    <nav className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
      {links.map(({ href, label, key }) =>
        key === active && !currentLabel ? (
          <span key={key} className="text-sm font-medium text-foreground">
            {label}
          </span>
        ) : (
          <Link
            key={key}
            href={href}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {label}
          </Link>
        )
      )}
      {currentLabel && (
        <span className="text-sm font-medium text-foreground">
          {currentLabel}
        </span>
      )}
    </nav>
  );
}
