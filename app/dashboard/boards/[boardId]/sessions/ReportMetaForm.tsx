"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { parseTemplateId, type TemplateId } from "@/lib/recap/templates";

const REPORT_PRESETS: Array<{
  id: TemplateId;
  label: string;
  description: string;
  values: {
    reportTitle: string;
    learningGoals: string;
  };
}> = [
  {
    id: "teacher_a4",
    label: "기본",
    description: "표준 교사용 보고서",
    values: {
      reportTitle: "수업 리캡 보고서",
      learningGoals: "- 핵심 개념 이해\n- 활동 참여 기록\n- 학습 성취 확인",
    },
  },
  {
    id: "parent_summary",
    label: "학부모용",
    description: "긍정 요약 중심",
    values: {
      reportTitle: "학부모 공유 요약",
      learningGoals: "- 오늘 수업에서 배운 핵심 내용을 간단히 설명합니다.\n- 가정에서 이어갈 활동을 정리합니다.",
    },
  },
  {
    id: "internal_data",
    label: "회의록형",
    description: "회의/내부 공유용",
    values: {
      reportTitle: "수업 회의록",
      learningGoals: "안건: \n결정 사항: \n다음 차시 준비:",
    },
  },
];

type ReportMetaFormValues = {
  reportTitle: string;
  schoolName: string;
  className: string;
  subject: string;
  teacherName: string;
  periodLabel: string;
  learningGoals: string;
  reportTemplate: TemplateId;
};

type ReportMetaFormProps = {
  action: (formData: FormData) => void;
  initialValues: {
    reportTitle?: string | null;
    schoolName?: string | null;
    className?: string | null;
    subject?: string | null;
    teacherName?: string | null;
    periodLabel?: string | null;
    learningGoals?: string | null;
    reportTemplate?: string | null;
  };
  updatedAt?: string | null;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "저장 중..." : "보고서 정보 저장"}
    </button>
  );
}

export default function ReportMetaForm({ action, initialValues, updatedAt }: ReportMetaFormProps) {
  const [values, setValues] = useState<ReportMetaFormValues>({
    reportTitle: initialValues.reportTitle ?? "",
    schoolName: initialValues.schoolName ?? "",
    className: initialValues.className ?? "",
    subject: initialValues.subject ?? "",
    teacherName: initialValues.teacherName ?? "",
    periodLabel: initialValues.periodLabel ?? "",
    learningGoals: initialValues.learningGoals ?? "",
    reportTemplate: parseTemplateId(initialValues.reportTemplate ?? undefined),
  });

  const applyPreset = (preset: (typeof REPORT_PRESETS)[number]) => {
    setValues((prev) => ({
      ...prev,
      reportTitle: preset.values.reportTitle,
      learningGoals: preset.values.learningGoals,
      reportTemplate: preset.id,
    }));
  };

  return (
    <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">보고서 정보</p>
          <p className="text-xs text-gray-500">
            {updatedAt
              ? `마지막 저장: ${new Date(updatedAt).toLocaleString("ko-KR")}`
              : "아직 저장된 보고서 정보가 없습니다."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {REPORT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-300"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <form action={action} className="grid gap-3 text-sm text-gray-700 md:grid-cols-2">
        <input type="hidden" name="report_template" value={values.reportTemplate} />
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-700" htmlFor="report_title">
            보고서 제목
          </label>
          <input
            id="report_title"
            name="report_title"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            maxLength={120}
            value={values.reportTitle}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, reportTitle: event.target.value }))
            }
            placeholder="수업 리캡 보고서"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700" htmlFor="school_name">
            학교
          </label>
          <input
            id="school_name"
            name="school_name"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            maxLength={120}
            value={values.schoolName}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, schoolName: event.target.value }))
            }
            placeholder="예: ○○초등학교"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700" htmlFor="class_name">
            반
          </label>
          <input
            id="class_name"
            name="class_name"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            maxLength={120}
            value={values.className}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, className: event.target.value }))
            }
            placeholder="예: 3학년 2반"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700" htmlFor="subject">
            과목
          </label>
          <input
            id="subject"
            name="subject"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            maxLength={120}
            value={values.subject}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, subject: event.target.value }))
            }
            placeholder="예: 과학"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700" htmlFor="teacher_name">
            교사
          </label>
          <input
            id="teacher_name"
            name="teacher_name"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            maxLength={120}
            value={values.teacherName}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, teacherName: event.target.value }))
            }
            placeholder="예: 김교사"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700" htmlFor="period_label">
            차시
          </label>
          <input
            id="period_label"
            name="period_label"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            maxLength={60}
            value={values.periodLabel}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, periodLabel: event.target.value }))
            }
            placeholder="예: 3교시"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-700" htmlFor="learning_goals">
            수업 목표
          </label>
          <textarea
            id="learning_goals"
            name="learning_goals"
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            rows={4}
            maxLength={1000}
            value={values.learningGoals}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, learningGoals: event.target.value }))
            }
            placeholder="핵심 학습 목표나 메모를 작성하세요."
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            선택 템플릿:{" "}
            {REPORT_PRESETS.find((preset) => preset.id === values.reportTemplate)?.description ??
              "표준 보고서"}
          </p>
          <SaveButton />
        </div>
      </form>
    </div>
  );
}
