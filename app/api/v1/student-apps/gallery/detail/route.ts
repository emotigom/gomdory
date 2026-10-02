const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function POST() {
  return error(410, "public_viewer_required", "공개된 친구 작품은 공개 보기 링크로만 열 수 있습니다.");
}
