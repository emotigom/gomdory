import Link from "next/link";
import { redirect } from "next/navigation";

import InlineAlert from "@/app/_components/InlineAlert";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import InviteAcceptClient from "./AcceptClient";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!token) {
    return redirect("/dashboard");
  }

  if (!user) {
    const returnTo = encodeURIComponent(`/invite/${token}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-16">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">초대 수락</h1>
          <p className="text-gray-600">로그인 후 초대를 수락할 수 있어요.</p>
        </div>
        <InlineAlert tone="info" title="로그인이 필요합니다" />
        <Link
          href={`/auth/login?returnTo=${returnTo}`}
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">초대 수락</h1>
        <p className="text-gray-600">초대를 수락하면 보드에 바로 접근할 수 있어요.</p>
      </div>
      <InviteAcceptClient token={token} />
    </div>
  );
}
