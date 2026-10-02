"use client";

import { Fragment } from "react";

import type { RecapSection, RecapSectionBlock } from "@/lib/recap/templates";

const DEFAULT_ATTACHMENTS_LIMIT = 2;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}

function AttachmentList({
  files,
  limit = DEFAULT_ATTACHMENTS_LIMIT,
  label,
  showExternalNotice = false,
}: {
  files: { id: string; filename: string; downloadPath?: string | null }[];
  limit?: number;
  label?: string;
  showExternalNotice?: boolean;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-gray-600">첨부파일이 없습니다.</p>;
  }

  const visible = files.slice(0, limit);
  const remaining = files.length - visible.length;

  return (
    <div className="space-y-1">
      {label ? <p className="text-xs font-semibold text-gray-700">{label}</p> : null}
      <ul className="space-y-1 text-xs text-gray-600">
        {visible.map((file) => (
          <li key={file.id}>
            {file.downloadPath ? (
              <a
                className="text-blue-600 hover:text-blue-700 hover:underline"
                href={file.downloadPath}
              >
                {file.filename}
              </a>
            ) : (
              <span>{file.filename}</span>
            )}
          </li>
        ))}
        {remaining > 0 ? <li>외 {remaining}개</li> : null}
      </ul>
      {showExternalNotice ? (
        <p className="text-[11px] text-gray-400">외부 링크입니다.</p>
      ) : null}
    </div>
  );
}

function renderStatsBlock(block: Extract<RecapSectionBlock, { type: "stats" }>) {
  const stats = block.stats;
  const content = (
    <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
      <p>총 카드: {stats?.totalCards ?? 0}개</p>
      <p>학생 카드: {stats?.studentCards ?? 0}개</p>
      <p>교사 카드: {stats?.teacherCards ?? 0}개</p>
      <p>참여 학생: {stats?.uniqueStudentAuthors ?? 0}명</p>
      <p>대표 카드: {block.featuredCount}개</p>
      <p>고정 카드: {block.pinnedCount}개</p>
      <div className="sm:col-span-2">
        <p className="font-medium text-gray-900">Top Authors</p>
        <p>
          {stats?.topAuthors?.length
            ? stats.topAuthors.map((author) => `${author.name}(${author.count})`).join(", ")
            : "없음"}
        </p>
      </div>
      <div className="sm:col-span-2">
        <p className="font-medium text-gray-900">Top Words</p>
        <p>
          {stats?.topWords?.length
            ? stats.topWords.map((word) => `${word.word}(${word.count})`).join(", ")
            : "없음"}
        </p>
      </div>
    </div>
  );

  if (block.collapsible) {
    return (
      <details className="rounded-lg border border-gray-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          {block.summaryLabel ?? "통계 보기"}
        </summary>
        <div className="mt-3">{content}</div>
      </details>
    );
  }

  return content;
}

function CardList({
  cards,
  variant,
  showExternalNotice,
}: {
  cards: Extract<RecapSectionBlock, { type: "cards" }>[
    "cards"
  ];
  variant: "featured" | "pinned" | "wall";
  showExternalNotice: boolean;
}) {
  if (cards.length === 0) {
    return <p className="text-sm text-gray-600">카드가 없습니다.</p>;
  }

  const cardStyles =
    variant === "featured"
      ? "border-amber-100 bg-amber-50"
      : variant === "pinned"
        ? "border-blue-100 bg-blue-50"
        : "border-gray-100 bg-gray-50";

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <article
          key={card.id}
          className={`space-y-2 rounded-lg border p-4 text-sm text-gray-800 print-card ${cardStyles}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span>{card.authorName ?? "이름 없음"}</span>
            <span>{formatDateTime(card.createdAt)}</span>
          </div>
          <p className="whitespace-pre-line text-sm text-gray-900">{card.text}</p>
          {card.files.length > 0 ? <AttachmentList files={card.files} label="첨부파일" /> : null}
          {card.externalFiles?.length ? (
            <AttachmentList
              files={card.externalFiles}
              label="외부 링크"
              showExternalNotice={showExternalNotice}
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default function RecapSections({
  sections,
  attachmentsLimit = DEFAULT_ATTACHMENTS_LIMIT,
  showExternalNotice = false,
}: {
  sections: RecapSection[];
  attachmentsLimit?: number;
  showExternalNotice?: boolean;
}) {
  return (
    <div className="space-y-8">
      {sections.map((section, sectionIndex) => (
        <section
          key={`${section.title}-${sectionIndex}`}
          className={`space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm print-section ${
            section.printBreak ? "print-break" : ""
          }`}
        >
          <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
          <div className="space-y-4">
            {section.blocks.map((block, blockIndex) => {
              if (block.type === "text") {
                return (
                  <div key={blockIndex} className="space-y-1">
                    {block.label ? (
                      <p className="text-sm font-semibold text-gray-900">{block.label}</p>
                    ) : null}
                    <p className="whitespace-pre-line text-sm text-gray-700">{block.text}</p>
                  </div>
                );
              }

              if (block.type === "stats") {
                return <div key={blockIndex}>{renderStatsBlock(block)}</div>;
              }

              if (block.type === "cards") {
                return (
                  <div key={blockIndex} className="space-y-3">
                    {block.title ? (
                      <h3 className="text-lg font-semibold text-gray-900">{block.title}</h3>
                    ) : null}
                    {block.wall ? (
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-900">{block.wall.title}</h3>
                        {block.wall.description ? (
                          <p className="text-sm text-gray-600">{block.wall.description}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <CardList
                      cards={block.cards}
                      variant={block.variant}
                      showExternalNotice={showExternalNotice}
                    />
                  </div>
                );
              }

              if (block.type === "attachments") {
                return (
                  <div key={blockIndex}>
                    <AttachmentList
                      files={block.files}
                      limit={attachmentsLimit}
                      label={block.label}
                      showExternalNotice={showExternalNotice && block.source === "external"}
                    />
                  </div>
                );
              }

              if (block.type === "memo") {
                return (
                  <div key={blockIndex} className="space-y-2">
                    <p className="text-sm text-gray-600">자유롭게 메모하세요.</p>
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, lineIndex) => (
                        <div key={lineIndex} className="h-6 border-b border-dashed border-gray-300" />
                      ))}
                    </div>
                  </div>
                );
              }

              return <Fragment key={blockIndex} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
