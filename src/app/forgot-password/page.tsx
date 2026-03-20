import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0c0e11] text-[#f9f9fd] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
        <div className="text-xl font-black tracking-tight">Reset your password</div>
        <p className="mt-2 text-sm text-white/60">
          Enter your email and we’ll send you a reset link.
        </p>

        <div className="mt-6">
          <ForgotPasswordForm />
        </div>

        <div className="mt-6 text-xs text-white/60">
          <Link href="/login" className="font-bold text-[#f3ffca] hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
