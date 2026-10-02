export type OpsAdminModule = {
  key: string;
  title: string;
  description: string;
  href: string;
  priority: 1 | 2 | 3;
};

export const OPS_ADMIN_MODULES: OpsAdminModule[] = [
  {
    key: "users",
    title: "Users",
    description: "사용자 검색, 상태 확인, 권한/정지 관리",
    href: "/dashboard/ops/users",
    priority: 1,
  },
  {
    key: "share-codes",
    title: "Easy Share Codes",
    description: "보드에 기억하기 쉬운 6자리 공유코드 지정 · 닫기 · 제거",
    href: "/dashboard/ops/share-codes",
    priority: 1,
  },
  {
    key: "content",
    title: "Content",
    description: "게시물/보드 콘텐츠 숨김 · 삭제 · 복구",
    href: "/dashboard/ops/content",
    priority: 1,
  },
  {
    key: "reports",
    title: "Community Reports",
    description: "커뮤니티 신고 필터링, 숨김/차단, 처리 상태 일괄 운영",
    href: "/dashboard/ops/reports",
    priority: 1,
  },
  {
    key: "community-moderation",
    title: "Community Comment Moderation",
    description: "댓글 신고 목록 조회, 숨김/복구, 스태프 메모 관리(ops 전용)",
    href: "/dashboard/ops/community-moderation",
    priority: 1,
  },
  {
    key: "banners",
    title: "Banners",
    description: "공지 바(메시지/링크/레벨) 노출 여부 운영",
    href: "/dashboard/ops/banners",
    priority: 1,
  },
  {
    key: "site-content",
    title: "Site Content",
    description: "마케팅/커뮤니티 페이지(usage/updates/roadmap/policy/community_usage/community_updates) 텍스트 편집/발행",
    href: "/dashboard/ops/site-content",
    priority: 1,
  },
  {
    key: "trash",
    title: "Trash Restore",
    description: "삭제된 항목 복구 + TTL 만료 정리(드라이런/실행)",
    href: "/dashboard/ops/trash",
    priority: 2,
  },
  {
    key: "system",
    title: "System/Jobs",
    description: "헬스 체크 및 처리 대기 작업 모니터링",
    href: "/dashboard/ops/system-jobs",
    priority: 2,
  },
];

export function findOpsModuleByHref(href: string) {
  return OPS_ADMIN_MODULES.find((item) => item.href === href) ?? null;
}
