"use client";

import { useMemo } from "react";

import { getWebllmClientEnvSnapshot, readWebllmEnvValue } from "@/lib/edu/llm/webllmConfig";

export const resolveWebllmModelId = () => {
  const primary = readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID")?.trim();
  if (primary) return primary;
  return "";
};

export const useWebLLM = () => {
  const modelId = useMemo(() => resolveWebllmModelId(), []);
  const envSnapshot = useMemo(() => getWebllmClientEnvSnapshot(), []);
  const hasWebllmEnv = envSnapshot.every((entry) => entry.isSet);
  return { modelId, hasWebllmEnv, envSnapshot };
};
