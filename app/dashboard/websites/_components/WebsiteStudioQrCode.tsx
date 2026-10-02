"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import * as QRCode from "qrcode";

type WebsiteStudioQrCodeProps = {
  url: string;
  label?: string;
  size?: number;
};

export default function WebsiteStudioQrCode({ url, label = "공개 링크 QR", size = 176 }: WebsiteStudioQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setDataUrl(null);
    QRCode.toDataURL(url)
      .then((next) => {
        if (active) setDataUrl(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [size, url]);

  if (failed) return <p className="text-xs text-slate-600">QR을 만들 수 없습니다. 링크를 복사해 주세요.</p>;
  if (!dataUrl) return <div aria-label="qr-loading" className="h-44 w-44 animate-pulse rounded border bg-slate-100" />;

  return <Image src={dataUrl} alt={label} width={size} height={size} className="rounded border bg-white p-1" unoptimized />;
}
