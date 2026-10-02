"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ChatPanel from "@/app/edu/_components/ChatPanel";
import type { WorkspaceFile } from "@/app/edu/_components/Workspace";
import { getLessonIdFromNumber, type LessonId, type LessonLock } from "@/lib/edu/lesson/lessonLock";
import { getLessonPreset, getLessonTemplateFiles } from "@/lib/edu/lessons";

const DEFAULT_LESSON_ID = 1;

const buildFileMap = (lessonId: number): Record<string, WorkspaceFile> => {
  const templateFiles = getLessonTemplateFiles(lessonId);
  return templateFiles.reduce<Record<string, WorkspaceFile>>((acc, file) => {
    acc[file.filename] = { content: file.content, contentType: file.contentType };
    return acc;
  }, {});
};

const lessonIdToNumber = (lessonId: LessonId) => {
  switch (lessonId) {
    case "P2":
      return 2;
    case "P3":
      return 3;
    case "P4":
      return 4;
    case "P1":
    default:
      return 1;
  }
};

export default function EduCoachPage() {
  const [lessonId, setLessonId] = useState(DEFAULT_LESSON_ID);
  const [lessonLock, setLessonLock] = useState<LessonLock>(() => ({
    enabled: true,
    lessonId: getLessonIdFromNumber(DEFAULT_LESSON_ID) ?? "P1",
    version: 1,
  }));
  const [presentationMode, setPresentationMode] = useState(false);
  const [files, setFiles] = useState<Record<string, WorkspaceFile>>(() =>
    buildFileMap(DEFAULT_LESSON_ID),
  );

  const lesson = useMemo(
    () => getLessonPreset(lessonId) ?? getLessonPreset(DEFAULT_LESSON_ID),
    [lessonId],
  );
  const allowedFilenames = useMemo(
    () => getLessonTemplateFiles(lessonId).map((file) => file.filename),
    [lessonId],
  );

  useEffect(() => {
    setFiles(buildFileMap(lessonId));
  }, [lessonId]);

  const handleSetLessonId = useCallback((nextLessonId: LessonId) => {
    setLessonLock((prev) => ({
      ...prev,
      enabled: true,
      lessonId: nextLessonId,
    }));
    setLessonId(lessonIdToNumber(nextLessonId));
  }, []);

  const handleToggleLessonLock = useCallback((next: boolean) => {
    setLessonLock((prev) => ({ ...prev, enabled: next }));
  }, []);

  const handleFilesMerged = useCallback((nextFiles: Record<string, WorkspaceFile>) => {
    setFiles(nextFiles);
  }, []);

  const handleTemplateStart = useCallback(() => {
    setFiles(buildFileMap(lessonId));
  }, [lessonId]);

  return (
    <section className="flex min-h-[calc(100vh-96px)] flex-col">
      <ChatPanel
        title={lesson?.title ?? "AI 코치"}
        goal={lesson?.goal ?? "코치와 함께 과제를 준비해요."}
        starterPromptSuggestions={lesson?.starterPromptSuggestions ?? []}
        lessonId={lesson?.id ?? DEFAULT_LESSON_ID}
        lessonLock={lessonLock}
        teacherUiEnabled={true}
        shareCode={null}
        onSetLessonId={handleSetLessonId}
        onToggleLessonLock={handleToggleLessonLock}
        allowedFilenames={allowedFilenames}
        currentFiles={files}
        onFilesMerged={handleFilesMerged}
        onTemplateStart={handleTemplateStart}
        presentationMode={presentationMode}
        onTogglePresentationMode={setPresentationMode}
        chatStorageKeyPrefix="edu:coach:v1"
      />
    </section>
  );
}
