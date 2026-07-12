"use client";
import Link from "next/link";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";

// Shared account dropdown for Sidebar (row trigger) and TopBar (avatar trigger).
export function AccountMenu({ variant = "avatar" }: { variant?: "avatar" | "row" }) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Link
        href="/login"
        className={
          variant === "row"
            ? "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-semibold text-itv-muted transition-colors hover:bg-itv-hover hover:text-itv-text"
            : "text-[13px] font-semibold text-itv-muted transition-colors hover:text-itv-text"
        }
      >
        Sign In
      </Link>
    );
  }

  const items = [
    ...(["super_admin", "channel_manager", "moderator"].includes(user.role)
      ? [{ href: "/admin", label: "Admin Dashboard" }]
      : []),
    { href: "/account", label: "Profile" },
    { href: "/browse", label: "My List" },
    { href: "/account/settings", label: "Settings" },
    { href: "/studio", label: "Creator Studio" },
  ];

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        aria-label="Account menu"
        className={
          variant === "row"
            ? "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-itv-hover"
            : "outline-none"
        }
      >
        <Avatar name={user.displayName ?? user.email} size="sm" ring="accent" />
        {variant === "row" && (
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-itv-text">
            {user.displayName ?? user.email}
          </span>
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={variant === "row" ? "start" : "end"}
          side={variant === "row" ? "top" : "bottom"}
          sideOffset={8}
          className="z-overlay w-44 rounded-lg border border-itv-border bg-itv-surface p-1 text-sm shadow-card"
        >
          {items.map((i) => (
            <Dropdown.Item key={i.href} asChild>
              <Link
                href={i.href}
                className="block rounded px-3 py-2 text-itv-text outline-none hover:bg-itv-hover"
              >
                {i.label}
              </Link>
            </Dropdown.Item>
          ))}
          <Dropdown.Item
            onSelect={() => void logout()}
            className="cursor-pointer rounded px-3 py-2 text-itv-accent outline-none hover:bg-itv-hover"
          >
            Logout
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
