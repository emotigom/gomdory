"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { TemplateMeta, TemplateId } from "@/lib/recap/templates";

export default function TemplateSelector({
  templateId,
  templates,
}: {
  templateId: TemplateId;
  templates: TemplateMeta[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateTemplate = (nextTemplate: TemplateId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("t", nextTemplate);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="hidden flex-wrap gap-2 sm:flex">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => updateTemplate(template.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              template.id === templateId
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            {template.label}
          </button>
        ))}
      </div>
      <div className="sm:hidden">
        <label className="text-sm font-medium text-gray-700" htmlFor="template-select">
          보고서 템플릿
        </label>
        <select
          id="template-select"
          className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          value={templateId}
          onChange={(event) => updateTemplate(event.target.value as TemplateId)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
