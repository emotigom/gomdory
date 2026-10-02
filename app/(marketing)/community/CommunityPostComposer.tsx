"use client";

import { useMemo, useState, useTransition } from "react";

import { apiV1Path } from "@/lib/standards/pathTypes";
import {
  COMMUNITY_POST_MAX_FILE_ATTACHMENTS,
  assertAllowedCommunityAttachmentMime,
  getFilenameExtension,
  toCommunityExternalAttachmentsFromLink,
} from "@/lib/community/postAttachments";
import { safeErrorMessage } from "@/lib/ui/safeErrors";
import { toCommunityRateLimitUxMessageFromError } from "@/lib/community/rateLimitUx";
import { classifyUploadError, toUserMessage } from "@/lib/uploads/uploadErrors";

type ComposerProps = {
  createPostAction: (formData: FormData) => Promise<void>;
  uploadBoardId: string | null;
};

type UploadedFile = {
  id: string;
  filename: string;
  mime: string | null;
  bytes: number;
};

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function CommunityPostComposer({ createPostAction, uploadBoardId }: ComposerProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canUpload = Boolean(uploadBoardId);

  const externalAttachmentsJson = useMemo(
    () => JSON.stringify(toCommunityExternalAttachmentsFromLink(linkInput)),
    [linkInput],
  );
  const fileIdsJson = useMemo(() => JSON.stringify(uploadedFiles.map((file) => file.id)), [uploadedFiles]);

  const remaining = COMMUNITY_POST_MAX_FILE_ATTACHMENTS - uploadedFiles.length;

  const onUploadSelected = async (inputFiles: FileList | null) => {
    if (!canUpload || !inputFiles || inputFiles.length === 0) {
      return;
    }

    setError(null);

    for (const file of Array.from(inputFiles)) {
      if (uploadedFiles.length >= COMMUNITY_POST_MAX_FILE_ATTACHMENTS) {
        setError(`첨부 파일은 최대 ${COMMUNITY_POST_MAX_FILE_ATTACHMENTS}개까지 가능합니다.`);
        return;
      }

      try {
        assertAllowedCommunityAttachmentMime(file.type || null);
        const sha256 = await sha256Hex(file);

        const prepareRes = await fetch(apiV1Path("files/upload/prepare"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardId: uploadBoardId,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            sha256,
            originalBytes: file.size,
            optimizedBytes: file.size,
            optimization: null,
          }),
        });

        if (!prepareRes.ok) {
          throw new Error("업로드 준비에 실패했습니다.");
        }

        const preparePayload = (await prepareRes.json()) as
          | { ok: true; deduped: true; existingFile: UploadedFile }
          | { ok: true; deduped?: false; upload: { r2Key: string; url: string; headers?: Record<string, string> } };

        let uploaded: UploadedFile | null = null;

        if ("deduped" in preparePayload && preparePayload.deduped) {
          uploaded = preparePayload.existingFile;
        } else {
          const uploadRes = await fetch(preparePayload.upload.url, {
            method: "PUT",
            headers: preparePayload.upload.headers,
            body: file,
          });

          if (!uploadRes.ok) {
            throw new Error("파일 업로드에 실패했습니다.");
          }

          const commitRes = await fetch(apiV1Path("files/upload/commit"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              boardId: uploadBoardId,
              r2Key: preparePayload.upload.r2Key,
              originalName: file.name,
              contentType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              sha256,
              originalBytes: file.size,
              optimizedBytes: file.size,
              optimization: null,
            }),
          });

          if (!commitRes.ok) {
            throw new Error("업로드 저장에 실패했습니다.");
          }

          const commitPayload = (await commitRes.json()) as { file?: UploadedFile };
          uploaded = commitPayload.file ?? null;
        }

        if (!uploaded?.id) {
          throw new Error("업로드 파일 정보를 확인하지 못했습니다.");
        }

        setUploadedFiles((prev) => {
          if (prev.some((entry) => entry.id === uploaded?.id)) {
            return prev;
          }

          return [...prev, uploaded!].slice(0, COMMUNITY_POST_MAX_FILE_ATTACHMENTS);
        });
      } catch (uploadError) {
        setError(toUserMessage(classifyUploadError(uploadError)));
        return;
      }
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">게시글 작성</h2>
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            try {
              await createPostAction(formData);
              setUploadedFiles([]);
              setLinkInput("");
            } catch (actionError) {
              setError(
                toCommunityRateLimitUxMessageFromError(actionError) ??
                  safeErrorMessage(actionError, { fallback: "게시글 등록에 실패했습니다." }),
              );
            }
          });
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <input name="title" required minLength={3} maxLength={140} placeholder="제목" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <select name="category" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="free">자유게시판</option>
            <option value="edu">교육자료</option>
            <option value="qna">질문/피드백</option>
          </select>
        </div>

        <textarea
          name="body"
          required
          minLength={1}
          maxLength={12000}
          placeholder="내용"
          rows={7}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm">
            <span>그림</span>
            <input
              type="file"
              accept="image/*"
              className="w-24 text-xs"
              disabled={!canUpload || remaining <= 0 || isPending}
              onChange={(event) => {
                void onUploadSelected(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <label className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm">
            <span>파일</span>
            <input
              type="file"
              className="w-24 text-xs"
              disabled={!canUpload || remaining <= 0 || isPending}
              onChange={(event) => {
                void onUploadSelected(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <input
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            name="link"
            maxLength={500}
            placeholder="링크 (선택)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <input type="hidden" name="attachmentFileIds" value={fileIdsJson} />
        <input type="hidden" name="externalAttachments" value={externalAttachmentsJson} />

        {!canUpload ? <p className="text-xs text-amber-700">첨부를 사용하려면 먼저 보드를 1개 이상 생성해 주세요.</p> : null}

        {uploadedFiles.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <li key={file.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700">
                <span>📎</span>
                <span>{file.filename}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 uppercase">{getFilenameExtension(file.filename)}</span>
                <button
                  type="button"
                  onClick={() => setUploadedFiles((prev) => prev.filter((entry) => entry.id !== file.id))}
                  className="text-slate-500 hover:text-slate-900"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button disabled={isPending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          {isPending ? "등록 중..." : "등록"}
        </button>
      </form>
    </section>
  );
}
