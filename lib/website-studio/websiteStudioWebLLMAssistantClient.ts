export type WebsiteStudioAssistantProgress = "idle" | "loading-package" | "selecting-model" | "loading-model" | "running" | "validating" | "complete" | "failed";

export function isWebsiteStudioAssistantBrowserReady(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

export async function runWebsiteStudioAssistantLocal(prompt: string, onProgress?: (value: WebsiteStudioAssistantProgress) => void): Promise<string> {
  try {
    onProgress?.("loading-package");
    const webllm = await import("@mlc-ai/web-llm");
    onProgress?.("selecting-model");
    const model = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
    // Local-only WebLLM runtime: never send prompt/response to Gomdory servers.
    onProgress?.("loading-model");
    const engine = await webllm.CreateMLCEngine(model);
    onProgress?.("running");
    const response = await engine.chat.completions.create({ messages: [{ role: "user", content: prompt }] });
    onProgress?.("complete");
    return response.choices[0]?.message?.content ?? "";
  } catch {
    onProgress?.("failed");
    return "";
  }
}
