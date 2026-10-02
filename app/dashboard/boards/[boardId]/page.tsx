import { requireUser } from "@/lib/auth/requireUser";
import {
  boardBoardHref,
  boardClassHref,
  boardHubHref,
} from "@/lib/dashboard/boardHrefs";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  other: {
    "gom:page": "dashboard_board",
  },
};

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeHref(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return href;
  return `/${href}`;
}

export default async function BoardHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams?: Promise<{ to?: string }>;
}) {
  const { boardId } = await params;
  const { to } = (await searchParams) ?? {};

  if (!UUID_REGEX.test(boardId)) {
    return notFound();
  }

  const hubHref = normalizeHref(boardHubHref(boardId));
  await requireUser(hubHref);

  const boardHref = normalizeHref(boardBoardHref(boardId));
  if (to === "present" || to === "remote") {
    redirect(boardHref);
  }

  const classHref = normalizeHref(boardClassHref(boardId));
  redirect(boardHref ?? classHref);
}
