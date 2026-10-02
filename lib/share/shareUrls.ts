import { SHORT_BASE_URL } from "@/lib/http/siteConfig";

function buildShareOriginPath(path: string): string {
  return `${SHORT_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getStudentUrl(code: string): string {
  return buildShareOriginPath(`/${code}`);
}

export function getStudentBoardUrl(code: string): string {
  return buildShareOriginPath(`/s/${code}`);
}

export function getProjectorUrl(code: string): string {
  return buildShareOriginPath(`/s/${code}/present`);
}

export function getShowUrl(code: string): string {
  return buildShareOriginPath(`/s/${code}/show`);
}

export function getSlidesUrl(code: string): string {
  return buildShareOriginPath(`/s/${code}/slides`);
}

export function getGridUrl(code: string): string {
  return buildShareOriginPath(`/s/${code}/grid`);
}

export function getJoinEntryUrl(): string {
  return SHORT_BASE_URL;
}
