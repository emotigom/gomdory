"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { buildJoinUrl } from "@/lib/http/publicLinks";
import { getStudentUrl } from "@/lib/share/shareUrls";

type QrImages = {
  entry: string | null;
  direct: string | null;
};

export function ShareQrButton({ code }: { code: string | null }) {
  const [open, setOpen] = useState(false);
  const [qrImages, setQrImages] = useState<QrImages>({ entry: null, direct: null });
  const [error, setError] = useState<string | null>(null);

  const entryUrl = useMemo(() => buildJoinUrl(), []);
  const directUrl = useMemo(() => (code ? getStudentUrl(code) : null), [code]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const generateQr = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const entryDataUrl = await toDataURL(entryUrl);
        const directDataUrl = directUrl ? await toDataURL(directUrl) : null;

        if (cancelled) return;

        setQrImages({ entry: entryDataUrl, direct: directDataUrl });
      } catch (generationError) {
        if (cancelled) return;

        const message =
          generationError instanceof Error
            ? generationError.message
            : "QR 코드를 생성하지 못했습니다.";
        setError(message);
      }
    };

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [directUrl, entryUrl, open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!code}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
      >
        QR 보기
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900">QR 코드</h2>
                <p className="text-sm text-gray-600">
                  학생이 쉽게 입장할 수 있도록 안내하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                닫기
              </button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-sm font-semibold text-gray-900">입장 페이지</p>
                {qrImages.entry ? (
                  <Image
                    src={qrImages.entry}
                    alt="입장 페이지 QR"
                    width={240}
                    height={240}
                    unoptimized
                    className="mx-auto h-auto w-48"
                  />
                ) : (
                  <p className="text-sm text-gray-500">생성 중...</p>
                )}
                <p className="text-xs text-gray-500 break-all">{entryUrl}</p>
              </div>

              {directUrl ? (
                <div className="space-y-2 rounded-lg border border-gray-200 p-4 text-center">
                  <p className="text-sm font-semibold text-gray-900">직접 링크</p>
                  {qrImages.direct ? (
                    <Image
                      src={qrImages.direct}
                      alt="직접 링크 QR"
                      width={240}
                      height={240}
                      unoptimized
                      className="mx-auto h-auto w-48"
                    />
                  ) : (
                    <p className="text-sm text-gray-500">생성 중...</p>
                  )}
                  <p className="text-xs text-gray-500 break-all">{directUrl}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
