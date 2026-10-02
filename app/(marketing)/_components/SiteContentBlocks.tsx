import Link from "next/link";

import type { SiteContentBlock } from "@/lib/site-content/blocks";
import { routes } from "@/lib/standards/routes";

function renderMarkdownLines(text: string): string[] {
  return text.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean);
}

export default function SiteContentBlocks({ blocks }: { blocks: SiteContentBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 2) return <h2 key={index} className="text-2xl font-semibold text-slate-900">{block.text}</h2>;
          if (block.level === 3) return <h3 key={index} className="text-xl font-semibold text-slate-900">{block.text}</h3>;
          return <h4 key={index} className="text-lg font-semibold text-slate-900">{block.text}</h4>;
        }

        if (block.type === "paragraph") {
          return <p key={index} className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{block.text}</p>;
        }

        if (block.type === "markdown") {
          return (
            <div key={index} className="space-y-2 text-sm leading-7 text-slate-700">
              {renderMarkdownLines(block.text).map((line) => (
                <p key={`${index}:${line.slice(0, 24)}`} className="whitespace-pre-wrap">{line}</p>
              ))}
            </div>
          );
        }

        if (block.type === "callout") {
          const toneClass =
            block.tone === "warn"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : block.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-indigo-200 bg-indigo-50 text-indigo-900";
          return <div key={index} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${toneClass}`}>{block.text}</div>;
        }

        if (block.type === "links") {
          return (
            <ul key={index} className="space-y-2">
              {block.items.map((item) => (
                <li key={`${item.href}:${item.label}`}>
                  <Link href={item.href} className="text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold">첨부 미디어 ({block.kind})</p>
            <Link href={routes.api.files.download(block.fileId)} className="mt-1 inline-flex text-indigo-700 underline-offset-2 hover:underline">
              파일 열기
            </Link>
          </div>
        );
      })}
    </div>
  );
}
