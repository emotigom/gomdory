export function isLabsTerminalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LABS_TERMINAL === "1";
}

export function isLabsVrWorldEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LABS_VR_WORLD === "1";
}

export function isLabsPracticeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LABS_PRACTICE === "1";
}
