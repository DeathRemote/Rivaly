import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen bg-[#0c0e11] text-[#f9f9fd] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
        <div className="text-xl font-black tracking-tight">Set a new password</div>
        <p className="mt-2 text-sm text-white/60">
          Choose a strong password. You’ll be able to log in immediately after.
        </p>

        <div className="mt-6">
          <ResetPasswordForm token={token ?? ""} />
        </div>
      </div>
    </div>
  );
}
