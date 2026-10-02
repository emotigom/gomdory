export type WebsiteStudioBlockKind = "hero" | "text" | "cardGrid" | "image" | "quiz" | "linkButton" | "footer";

export type WebsiteStudioBlock = {
  id: string;
  kind: WebsiteStudioBlockKind;
  title?: string;
  content?: string;
  items?: { title: string; description: string }[];
  imageAlt?: string;
  imageUrl?: string;
  buttonLabel?: string;
  buttonHref?: string;
};

export type WebsiteStudioPage = {
  id: string;
  title: string;
  slug: string;
  blocks: WebsiteStudioBlock[];
};

export type WebsiteStudioTheme = {
  id: string;
  name: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
};

export type WebsiteStudioProject = {
  id: string;
  title: string;
  templateId: string;
  theme: WebsiteStudioTheme;
  pages: WebsiteStudioPage[];
  createdAt: string;
  updatedAt: string;
  originBoardId?: string;
  originSource?: string;
  originDay?: string;
};

export type WebsiteStudioTemplate = {
  id: string;
  name: string;
  description: string;
  recommendedFor: string;
  theme: WebsiteStudioTheme;
  starterPages: WebsiteStudioPage[];
};
