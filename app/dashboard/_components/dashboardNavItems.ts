import { routes } from "@/lib/standards/routes";

export type DashboardNavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  requiresAdmin?: boolean;
  disabled?: boolean;
};

export type DashboardNavSection = {
  id: string;
  label: string;
  description?: string;
  collapsible?: boolean;
  requiresAdmin?: boolean;
  items: DashboardNavItem[];
};

export const dashboardNavSections: DashboardNavSection[] = [
  {
    id: "primary",
    label: "Primary",
    description: "자주 쓰는 교사 워크플로",
    items: [
      { id: "boards", label: "보드", href: routes.page.dashboard.root(), description: "대시보드 보드 목록" },
      { id: "classes", label: "반/수업", href: routes.page.dashboard.classes(), description: "수업 단위 관리" },
      { id: "gallery", label: "갤러리", href: routes.page.dashboard.gallery(), description: "작품 모음" },
      { id: "files", label: "파일", href: routes.page.dashboard.files(), description: "파일 보관함" },
      { id: "library", label: "수업자료실", href: routes.page.dashboard.library(), description: "공개 수업자료" },
      { id: "templates", label: "템플릿", href: routes.page.dashboard.templates(), description: "수업용 템플릿" },
    ],
  },
  {
    id: "secondary",
    label: "Secondary",
    description: "가끔 쓰는 기능",
    items: [
      { id: "import", label: "가져오기", href: routes.page.dashboard.import.board(), description: "보드 가져오기" },
      { id: "offline", label: "오프라인", href: routes.page.dashboard.offline(), description: "오프라인 대응" },
      {
        id: "first-lesson",
        label: "첫 수업",
        href: routes.page.dashboard.firstLesson(),
        description: "첫 수업 설정",
      },
      { id: "billing", label: "결제/플랜", href: routes.page.dashboard.billing(), description: "플랜 관리" },
      { id: "settings", label: "교사설정", href: routes.page.dashboard.settings(), description: "설정 홈" },
    ],
  },
  {
    id: "admin",
    label: "고급/실험실",
    description: "운영·진단용 페이지 (관리자)",
    collapsible: true,
    requiresAdmin: true,
    items: [
      {
        id: "ops",
        label: "Ops",
        href: routes.page.dashboard.ops(),
        description: "운영 콘솔",
        requiresAdmin: true,
      },
      {
        id: "audit",
        label: "Audit",
        href: routes.page.dashboard.audit(),
        description: "감사 로그",
        requiresAdmin: true,
      },
      {
        id: "diagnostics",
        label: "Diagnostics",
        href: routes.page.dashboard.system(),
        description: "시스템 진단",
        requiresAdmin: true,
      },
    ],
  },
];
