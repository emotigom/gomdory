"use client";

import Link from "next/link";

import { buttonTone, cn } from "@/app/_components/uiTokens";

type PrintButtonProps = {
  printHref: string;
  backHref: string;
  isPrintMode: boolean;
};

export default function PrintButton({ printHref, backHref, isPrintMode }: PrintButtonProps) {
  if (isPrintMode) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[40px]")}
        >
          인쇄/PDF 저장
        </button>
        <Link href={backHref} className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}>
          돌아가기
        </Link>
      </div>
    );
  }

  return (
    <Link href={printHref} className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}>
      인쇄/PDF
    </Link>
  );
}
