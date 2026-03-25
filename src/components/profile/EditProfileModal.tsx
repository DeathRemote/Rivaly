"use client";

import { useState, useTransition } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { updateProfileAction } from "@/app/profile/actions";

export function EditProfileModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: {
    displayName: string;
    username: string;
    email: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [email, setEmail] = useState(initial.email);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function onSave() {
    setError(null);

    startTransition(async () => {
      const res = await updateProfileAction({
        displayName,
        username,
        email,
        currentPassword,
        newPassword,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      onClose();
      // Refreshing server components ensures updated session/user data shows.
      window.location.reload();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      description="Update your identity and security settings."
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
            {error}
          </div>
        ) : null}

        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
            placeholder="Kinetic Player"
          />
        </Field>

        <Field label="Username">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
            placeholder="kinetic_player"
          />
          <p className="mt-2 text-[11px] text-white/45">
            Letters, numbers, underscore. Used for shareable profile URLs later.
          </p>
        </Field>

        <Field label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
            placeholder="you@domain.com"
          />
          <p className="mt-2 text-[11px] text-white/45">
            Note: email change is applied immediately. Add verification later if needed.
          </p>
        </Field>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Password
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="Current password"
            />
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              placeholder="New password (min 8 chars)"
            />
          </div>
          <p className="mt-2 text-[11px] text-white/45">
            If you signed up with Google, setting a password is optional.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={pending}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 mb-2">
        {label}
      </div>
      {children}
    </label>
  );
}
