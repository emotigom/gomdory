import { getProjectorUrl, getStudentUrl } from "@/lib/share/shareUrls";

export type ShareLinkInfo = {
  boardId: string;
  code: string;
  shareUrl: string;
  presentUrl: string;
};

export function buildShareUrls(code: string) {
  return {
    shareUrl: getStudentUrl(code),
    presentUrl: getProjectorUrl(code),
  };
}

export function buildShareLinkInfo(boardId: string, code: string): ShareLinkInfo {
  const { shareUrl, presentUrl } = buildShareUrls(code);
  return {
    boardId,
    code,
    shareUrl,
    presentUrl,
  };
}
