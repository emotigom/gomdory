import Link from "next/link";

type PdfDownloadButtonProps = {
  href: string;
  fileName: string;
  label?: string;
};

export function PdfDownloadButton({
  href,
  fileName,
  label = "개인정보처리방침 PDF 다운로드",
}: PdfDownloadButtonProps) {
  const isExternal = href.startsWith("https://assets.gomdory.com/");
  return (
    <Link
      href={href}
      download={fileName}
      title={label}
      aria-label={label}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="legal-control legal-control-light inline-flex items-center gap-2 rounded-lg border border-rose-300/60 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm"
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700"
      >
        PDF
      </span>
      <span>{label}</span>
    </Link>
  );
}
