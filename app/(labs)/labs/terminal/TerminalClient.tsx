"use client";

import { FormEvent, useMemo, useState } from "react";

import PracticeWorkspaceClient from "./PracticeWorkspaceClient";

type ShellLine = {
  id: number;
  text: string;
};

const FILES: Record<string, string> = {
  "README.txt": "Labs Terminal 프로토타입입니다. help 명령으로 시작해 보세요.",
  "lesson.md": "# Lesson\n\n- echo 로 출력\n- cat 으로 파일 읽기\n- clear 로 화면 정리",
};

const HELP_TEXT = [
  "사용 가능한 명령:",
  "help - 명령 목록 보기",
  "clear - 출력 지우기",
  "echo [text] - 텍스트 출력",
  "date - 현재 시간 출력",
  "ls - 파일 목록 출력",
  "cat [file] - 파일 내용 출력",
];

export default function TerminalClient({ boardId, practiceEnabled }: { boardId?: string; practiceEnabled?: boolean }) {
  const [lines, setLines] = useState<ShellLine[]>([
    { id: 1, text: "labs-shell v0.1" },
    { id: 2, text: "help 를 입력해 명령을 확인하세요." },
  ]);
  const [input, setInput] = useState("");
  const [lastCommand, setLastCommand] = useState("");
  const [tab, setTab] = useState<"terminal" | "practice">("terminal");

  const prompt = useMemo(() => "$", []);

  const appendLine = (text: string) => {
    setLines((prev) => [...prev, { id: prev.length + 1, text }]);
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    appendLine(`${prompt} ${raw}`);

    if (!trimmed) {
      return;
    }

    const [command, ...rest] = trimmed.split(" ");
    const argText = rest.join(" ");

    switch (command) {
      case "help":
        HELP_TEXT.forEach(appendLine);
        break;
      case "clear":
        setLines([]);
        break;
      case "echo":
        appendLine(argText || "");
        break;
      case "date":
        appendLine(new Date().toLocaleString("ko-KR"));
        break;
      case "ls":
        appendLine(Object.keys(FILES).join("  "));
        break;
      case "cat": {
        const fileName = argText.trim();
        if (!fileName) {
          appendLine("파일명을 입력해 주세요.");
          break;
        }
        appendLine(FILES[fileName] ?? `cat: ${fileName}: 파일을 찾을 수 없습니다.`);
        break;
      }
      default:
        appendLine(`${command}: 알 수 없는 명령입니다.`);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const current = input;
    setInput("");
    if (current.trim()) {
      setLastCommand(current);
    }
    runCommand(current);
  };

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("terminal")}
          className={`rounded-md px-3 py-1 text-sm ${tab === "terminal" ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
        >
          터미널
        </button>
        <button
          type="button"
          onClick={() => setTab("practice")}
          className={`rounded-md px-3 py-1 text-sm ${tab === "practice" ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
        >
          실습
        </button>
      </div>

      {tab === "terminal" ? (
        <>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-100">
        <div className="h-72 overflow-y-auto rounded border border-neutral-700 bg-neutral-900 p-3 font-mono">
          {lines.length === 0 ? <p className="text-neutral-500">출력이 비워졌습니다.</p> : null}
          {lines.map((line) => (
            <p key={line.id} className="whitespace-pre-wrap break-words leading-6">
              {line.text}
            </p>
          ))}
        </div>
        <form className="mt-3 flex items-center gap-2 font-mono" onSubmit={handleSubmit}>
          <span>{prompt}</span>
          <input
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 outline-none ring-offset-1 focus:ring-1 focus:ring-neutral-400"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setInput(lastCommand);
              }
            }}
            placeholder="명령 입력"
            value={input}
          />
          <button className="rounded border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800" type="submit">
            실행
          </button>
        </form>
      </div>

          <div className="rounded-lg border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold text-neutral-900">실습 워크스페이스가 준비되었습니다.</h2>
            <p className="mt-2 text-sm text-neutral-600">상단 “실습” 탭에서 HTML/CSS/JS 편집과 미리보기를 이용하세요.</p>
          </div>
        </>
      ) : (
        <PracticeWorkspaceClient boardId={boardId} practiceEnabled={practiceEnabled} />
      )}
    </section>
  );
}
