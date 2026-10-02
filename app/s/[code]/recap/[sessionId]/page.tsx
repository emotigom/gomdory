import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { headers } from "next/headers";

import { getSharedRecap } from "@/lib/data/recap";
import { getHost, redirectToHostIfNeeded, STUDENT_HOST, TEACHER_HOST } from "@/lib/http/hosts";
import RecapSections from "@/lib/recap/RecapSections";
import {
  listTemplates,
  parseTemplateId,
  renderSections,
  type RecapData,
} from "@/lib/recap/templates";
import RecapActions from "./RecapActions";
import TemplateSelector from "./TemplateSelector";

function formatTimeRange(startedAt: string, endedAt: string) {
  const started = new Date(startedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const ended = new Date(endedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${started} ~ ${ended}`;
}

export default async function SharedRecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; sessionId: string }>;
  searchParams?: Promise<{ t?: string }>;
}) {
  const requestHeaders = await headers();
  const host = await getHost();

  await redirectToHostIfNeeded({
    desiredHost: STUDENT_HOST,
    requestUrl: new URL(
      requestHeaders.get("x-url") ?? "/s",
      `https://${host || TEACHER_HOST}`,
    ),
  });

  const { code, sessionId } = await params;
  const { t } = (await searchParams) ?? {};
  const recap = await getSharedRecap({ code, sessionId });

  if (!recap) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">공유 리캡을 찾을 수 없어요</h1>
        <p className="text-gray-600">
          공유가 종료되었거나 권한이 없을 수 있어요. 선생님께 새 링크를 요청해주세요.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          선생님께 새 링크를 요청하세요
        </Link>
      </div>
    );
  }

  const endedAt = new Date(recap.session.endedAt);
  const dateLabel = endedAt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeRange = formatTimeRange(recap.session.startedAt, recap.session.endedAt);
  const templateId = parseTemplateId(t ?? recap.session.reportTemplate);
  const jsonUrl = apiV1Path(`share/${recap.board.shareCode}/recap/${recap.session.id}/export?format=json`);
  const mdUrl = apiV1Path(`share/${recap.board.shareCode}/recap/${recap.session.id}/export?format=md&t=${templateId}`);
  const recapData: RecapData = {
    board: {
      id: recap.board.id,
      title: recap.board.title,
      shareCode: recap.board.shareCode,
    },
    session: {
      id: recap.session.id,
      startedAt: recap.session.startedAt,
      endedAt: recap.session.endedAt,
      notice: recap.session.notice,
      rulesText: recap.session.rulesText,
      stats: recap.session.stats,
      reportTitle: recap.session.reportTitle,
      schoolName: recap.session.schoolName,
      className: recap.session.className,
      subject: recap.session.subject,
      teacherName: recap.session.teacherName,
      periodLabel: recap.session.periodLabel,
      learningGoals: recap.session.learningGoals,
      reportTemplate: recap.session.reportTemplate,
      reportUpdatedAt: recap.session.reportUpdatedAt,
    },
    walls: recap.walls.map((wall) => ({
      id: wall.id,
      title: wall.title,
      description: wall.description,
    })),
    cards: recap.cards.map((card) => ({
      id: card.id,
      wallId: card.wallId,
      text: card.text,
      authorType: card.authorType,
      authorName: card.authorName,
      createdAt: card.createdAt,
      isFeatured: card.isFeatured,
      isPinned: card.isPinned,
      files: card.files.map((file) => ({
        id: file.fileId,
        filename: file.filename,
        downloadPath: apiV1Path(`share/${recap.board.shareCode}/files/${file.fileId}/download`),
      })),
      externalFiles: card.externalAttachments.map((file, index) => ({
        id: `${card.id}-external-${index}`,
        filename: file.filename,
        downloadPath: file.downloadPath ?? undefined,
      })),
    })),
  };
  const sections = renderSections(templateId, recapData);
  const templates = listTemplates();
  const reportTitle =
    recap.session.reportTitle?.trim() || `${recap.board.title} 수업 리캡`;
  const metaLine = [
    recap.session.schoolName ? `학교 ${recap.session.schoolName}` : null,
    recap.session.className ? `반 ${recap.session.className}` : null,
    recap.session.subject ? `과목 ${recap.session.subject}` : null,
    recap.session.teacherName ? `교사 ${recap.session.teacherName}` : null,
    recap.session.periodLabel ? `차시 ${recap.session.periodLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6 print-container">
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          body { background: white; padding-top: 30mm; padding-bottom: 18mm; counter-reset: page; }
          .print-hidden { display: none !important; }
          .print-container { max-width: 100% !important; padding: 0 !important; }
          .print-header, .print-footer { position: fixed; left: 0; right: 0; color: #111827; }
          .print-header { top: 0; padding: 8mm 0 4mm; }
          .print-footer { bottom: 0; padding: 4mm 0 8mm; text-align: center; font-size: 10px; }
          .print-footer::after { content: "페이지 " counter(page); }
          .print-section { break-inside: avoid; page-break-inside: avoid; }
          .print-break { break-before: page; }
          .print-card { break-inside: avoid; page-break-inside: avoid; }
          .print-keep { break-inside: avoid; page-break-inside: avoid; }
          .print-container p, .print-container li { line-height: 1.6; }
          .print-container ul { margin-top: 4px; margin-bottom: 4px; }
        }
      `}</style>
      <div className="print-header hidden print:block">
        <div className="border-b border-gray-300 pb-2 text-sm">
          <p className="font-semibold">{reportTitle}</p>
          <p>{dateLabel}</p>
          <p>{metaLine || "보고서 정보 미입력"}</p>
        </div>
      </div>
      <div className="print-footer hidden print:block" />
      <div className="space-y-3 print-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">수업 리캡</p>
            <h1 className="text-3xl font-bold text-gray-900">{reportTitle}</h1>
            <p className="text-sm text-gray-600">
              {dateLabel} · {timeRange}
            </p>
          </div>
          <RecapActions jsonUrl={jsonUrl} mdUrl={mdUrl} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">보고서 정보</p>
              <p className="text-sm text-gray-700">{metaLine || "보고서 정보 미입력"}</p>
            </div>
            <div className="text-xs text-gray-500">
              <p>작성일: {dateLabel}</p>
              <p>수업 시간: {timeRange}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">보고서 템플릿</p>
            <p className="text-xs text-gray-600">
              {templates.find((template) => template.id === templateId)?.description}
            </p>
          </div>
          <TemplateSelector templateId={templateId} templates={templates} />
        </div>
      </div>
      <RecapSections sections={sections} showExternalNotice />
    </div>
  );
}
