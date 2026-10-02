import Link from "next/link";

import type { Board } from "@/lib/data/boards";
import { buildJoinUrl, buildShareUrl } from "@/lib/http/publicLinks";

import { ShareQrButton } from "../ShareQrModal";
import { CopyTextButton, ConfirmSubmitButton } from "@/app/_components/BoardSettingsDrawer";
import {
  applyNoticeTemplate,
  applyRulesTemplate,
  endClassWithNotice,
  setBoardRules,
  setClassNotice,
  setClassState,
  startClass,
} from "../classActions";
import { deleteWallAction, createWallFromDrawerAction } from "../actions";
import { disableShare, enableShare, rotateShare, toggleWriteEnabled } from "../shareActions";
import OfflinePackButton from "./OfflinePackButton";
import WallV2SettingsPanel from "./WallV2SettingsPanel";

type WallSummary = {
  id: string;
  title: string;
  description: string | null;
  cardCount: number;
};

type BoardSettingsDrawerContentProps = {
  board: Board;
  boardId: string;
  walls: WallSummary[];
  shareCode: string | null;
  shareEnabled: boolean;
};

function ShareLinkRow({
  label,
  value,
  disabled,
}: {
  label: string;
  value: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
      <div>
        <p className="text-xs font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{disabled ? "공유를 켜주세요" : value}</p>
      </div>
      <CopyTextButton value={value} disabled={disabled} />
    </div>
  );
}

export default function BoardSettingsDrawerContent({
  board,
  boardId,
  walls,
  shareCode,
  shareEnabled,
}: BoardSettingsDrawerContentProps) {
  const shareAvailable = shareEnabled && Boolean(shareCode);
  const entryUrl = buildJoinUrl();
  const shareUrl = shareCode ? buildShareUrl(shareCode) : "";
  const shareBaseUrl = shareAvailable ? shareUrl : "";

  const enableShareAction = enableShare.bind(null, boardId);
  const disableShareAction = disableShare.bind(null, boardId);
  const rotateShareAction = rotateShare.bind(null, boardId);
  const enableWriteAction = toggleWriteEnabled.bind(null, boardId, true);
  const disableWriteAction = toggleWriteEnabled.bind(null, boardId, false);
  const setClassStateIdle = setClassState.bind(null, boardId, "idle");
  const setClassStateLive = setClassState.bind(null, boardId, "live");
  const setClassStateEnded = setClassState.bind(null, boardId, "ended");
  const startClassAction = startClass.bind(null, boardId);
  const saveNoticeAction = setClassNotice.bind(null, boardId);
  const saveRulesAction = setBoardRules.bind(null, boardId);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">학생 공유</p>
            <p className="text-xs text-gray-600">
              현재 상태: {shareEnabled ? "켜짐" : "꺼짐"} · 코드: {shareCode ?? "-"}
            </p>
          </div>
          <ShareQrButton code={shareCode} />
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={enableShareAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              공유 켜기
            </button>
          </form>
          <form action={rotateShareAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              코드 회전
            </button>
          </form>
          <form action={disableShareAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              공유 끄기
            </button>
          </form>
        </div>
        <div className="grid gap-2">
          <ShareLinkRow label="학생 접속(코드 입력)" value={entryUrl} disabled={false} />
          <ShareLinkRow label="학생 바로 입장" value={shareUrl} disabled={!shareAvailable} />
          {walls.length > 0 ? (
            <>
              {walls.map((wall) => (
                <div key={wall.id} className="grid gap-2 md:grid-cols-2">
                  <ShareLinkRow
                    label={`${wall.title} · 프로젝터`}
                    value={`${shareBaseUrl}/walls/${wall.id}/present`}
                    disabled={!shareAvailable}
                  />
                  <ShareLinkRow
                    label={`${wall.title} · 슬라이드`}
                    value={`${shareBaseUrl}/walls/${wall.id}/present/slides`}
                    disabled={!shareAvailable}
                  />
                </div>
              ))}
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">오프라인 저장</p>
            <p className="text-xs text-gray-600">
              네트워크 없이도 보드를 열 수 있도록 ZIP을 저장합니다.
            </p>
          </div>
        </div>
        <OfflinePackButton boardId={boardId} boardTitle={board.title} />
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">학생 글쓰기</p>
            <p className="text-xs text-gray-600">
              {board.share_write_enabled
                ? "학생이 글쓰기를 할 수 있습니다."
                : "잠금 상태입니다. 읽기만 가능합니다."}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={enableWriteAction}>
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                허용
              </button>
            </form>
            <form action={disableWriteAction}>
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                잠금
              </button>
            </form>
          </div>
        </div>
      </section>

      <WallV2SettingsPanel boardId={boardId} />

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">수업 상태</p>
            <p className="text-xs text-gray-600">
              최근 업데이트: {new Date(board.class_updated_at).toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={startClassAction}>
              <button
                type="submit"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-white"
              >
                수업 시작
              </button>
            </form>
            <form action={setClassStateIdle}>
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                대기
              </button>
            </form>
            <form action={setClassStateLive}>
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                진행
              </button>
            </form>
            <form action={setClassStateEnded}>
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                종료
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-md bg-gray-50 p-3 text-xs font-semibold text-gray-700">
          <span>공지 템플릿</span>
          <button
            formAction={applyNoticeTemplate.bind(
              null,
              boardId,
              "자리에 앉고 조용히 해주세요.",
            )}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            정숙 안내
          </button>
          <button
            formAction={applyNoticeTemplate.bind(
              null,
              boardId,
              "지금부터 담벼락에 한 줄 소감을 남겨주세요.",
            )}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            소감 작성
          </button>
          <button
            formAction={applyNoticeTemplate.bind(
              null,
              boardId,
              "질문이 있으면 손 들고 말해주세요.",
            )}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            질의 응답
          </button>
          <button
            formAction={applyNoticeTemplate.bind(
              null,
              boardId,
              "마무리: 오늘 배운 것 1개 적기!",
            )}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            마무리 적기
          </button>
          <button
            formAction={endClassWithNotice.bind(
              null,
              boardId,
              "수업 종료! 정리하고 나가요.",
            )}
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 transition hover:bg-white"
          >
            종료 공지
          </button>
        </div>

        <form className="space-y-2" action={saveNoticeAction}>
          <label className="text-sm font-semibold text-gray-900" htmlFor="drawer-class-notice">
            공지 메시지
          </label>
          <textarea
            id="drawer-class-notice"
            name="notice"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            rows={3}
            defaultValue={board.class_notice ?? ""}
            maxLength={300}
            placeholder="수업 안내를 입력하세요 (최대 300자)"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              공지 저장
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">규칙/공지(학생용)</p>
            <p className="text-xs text-gray-600">
              최근 업데이트: {new Date(board.rules_updated_at).toLocaleString("ko-KR")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-md bg-gray-50 p-3 text-xs font-semibold text-gray-700">
          <span>규칙 템플릿</span>
          <button
            formAction={applyRulesTemplate.bind(null, boardId, "규칙: 욕설/비방 금지")}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            욕설/비방 금지
          </button>
          <button
            formAction={applyRulesTemplate.bind(null, boardId, "규칙: 한 사람당 1번씩")}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            한 사람당 1번씩
          </button>
          <button
            formAction={applyRulesTemplate.bind(null, boardId, "규칙: 질문은 짧게")}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            질문은 짧게
          </button>
          <button
            formAction={applyRulesTemplate.bind(null, boardId, "규칙: 발표 끝나면 박수")}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50"
          >
            발표 끝나면 박수
          </button>
        </div>

        <form className="space-y-2" action={saveRulesAction}>
          <label className="text-sm font-semibold text-gray-900" htmlFor="drawer-class-rules">
            학생 규칙/공지
          </label>
          <textarea
            id="drawer-class-rules"
            name="rules"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            rows={4}
            defaultValue={board.rules_text ?? ""}
            maxLength={800}
            placeholder="학생에게 보여줄 규칙/공지를 입력하세요 (최대 800자)"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              규칙 저장
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">담벼락 관리</h3>
          <span className="text-xs text-gray-500">총 {walls.length}개</span>
        </div>

        <form className="space-y-3" action={createWallFromDrawerAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700" htmlFor="drawer-wall-title">
              담벼락 제목
            </label>
            <input
              id="drawer-wall-title"
              name="title"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="담벼락 제목"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-semibold text-gray-700"
              htmlFor="drawer-wall-description"
            >
              설명 (선택)
            </label>
            <textarea
              id="drawer-wall-description"
              name="description"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              placeholder="설명을 입력하세요"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
            >
              추가
            </button>
          </div>
        </form>

        {walls.length === 0 ? (
          <p className="text-sm text-gray-500">아직 담벼락이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {walls.map((wall) => {
              const warningMessage =
                wall.cardCount > 0
                  ? `카드가 ${wall.cardCount}개 있습니다. 삭제할까요?`
                  : "담벼락을 삭제할까요?";
              return (
                <li
                  key={wall.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{wall.title}</p>
                      {wall.description ? (
                        <p className="text-xs text-gray-500">{wall.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-gray-500">
                        카드 {wall.cardCount}개
                      </p>
                      {wall.cardCount > 0 ? (
                        <p className="mt-1 text-xs font-semibold text-amber-600">
                          카드가 {wall.cardCount}개 있습니다.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/boards/${boardId}/walls/${wall.id}/edit`}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-white"
                      >
                        이름 변경
                      </Link>
                      <form action={deleteWallAction}>
                        <input type="hidden" name="boardId" value={boardId} />
                        <input type="hidden" name="wallId" value={wall.id} />
                        <ConfirmSubmitButton
                          message={warningMessage}
                          className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          삭제
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
