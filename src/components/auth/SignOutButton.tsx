"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="h-10 rounded-full border border-white/15 px-4 text-xs font-bold uppercase tracking-widest text-white/80 hover:bg-white/5"
    >
      Sign out
    </button>
  );
}
