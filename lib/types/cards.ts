export const CARD_COLOR_TOKENS = [
  "default",
  "gray",
  "yellow",
  "pink",
  "green",
  "purple",
  "sky",
  "orange",
] as const;

export type CardColorToken = (typeof CARD_COLOR_TOKENS)[number];

export function isCardColorToken(value: string): value is CardColorToken {
  return (CARD_COLOR_TOKENS as readonly string[]).includes(value);
}
