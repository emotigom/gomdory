import { routes } from "@/lib/standards/routes";

export type DashboardSettingsStatus = {
  label: string;
  tone?: "neutral" | "info" | "warning" | "admin";
};

export type DashboardSettingsItem = {
  id: string;
  label: string;
  description: string;
  href?: string;
  status?: DashboardSettingsStatus;
  disabled?: boolean;
  requiresAdmin?: boolean;
};

export type DashboardSettingsSection = {
  id: string;
  title: string;
  description: string;
  collapsible?: boolean;
  items: DashboardSettingsItem[];
};

export const dashboardSettingsSections: DashboardSettingsSection[] = [
  {
    id: "general",
    title: "수업 살림",
    description: "수업을 열기 전에 챙길 기본값과 보관 공간이에요.",
    items: [
      {
        id: "billing",
        label: "플랜과 결제",
        description: "사용 중인 플랜과 결제 정보를 확인해요.",
        href: routes.page.dashboard.billing(),
        status: { label: "사용 중", tone: "info" },
      },
      {
        id: "classes",
        label: "반과 수업 기본값",
        description: "반 이름과 수업의 시작 구성을 정해요.",
        href: routes.page.dashboard.classes(),
      },
      {
        id: "files",
        label: "파일 보관함",
        description: "수업에 쓸 자료를 모아두고 꺼내 써요.",
        href: routes.page.dashboard.files(),
      },
    ],
  },
  {
    id: "design",
    title: "화면과 작업 방식",
    description: "내용은 그대로 두고, 보기 편한 밀도와 도구 배치를 골라요.",
    items: [
      {
        id: "dashboard-view",
        label: "대시보드 보기",
        description: "한눈에 볼 정보의 양을 내 작업 흐름에 맞춰요.",
        href: routes.page.dashboard.root(),
        status: { label: "수업 홈", tone: "neutral" },
      },
      {
        id: "board-ui",
        label: "보드 작업 도구",
        description: "미니맵과 도구의 표시 방식을 보드마다 정해요.",
        href: routes.page.dashboard.root(),
        status: { label: "보드마다", tone: "neutral" },
      },
      {
        id: "user-custom",
        label: "내 화면 꾸미기",
        description: "색, 배경, 글꼴, 간격을 내 계정에 저장해요.",
        href: routes.page.dashboard.settingsCustomize(),
        status: { label: "직접 설정", tone: "info" },
      },
    ],
  },
  {
    id: "recovered",
    title: "수업 도구함",
    description: "수업을 준비하고 옮기고 정리할 때 필요한 도구예요.",
    items: [
      {
        id: "templates",
        label: "템플릿",
        description: "자주 쓰는 수업 구성을 복사해서 시작해요.",
        href: routes.page.dashboard.templates(),
      },
      {
        id: "gallery",
        label: "작품 모아보기",
        description: "완성된 작품을 한자리에서 둘러봐요.",
        href: routes.page.dashboard.gallery(),
      },
      {
        id: "first-lesson",
        label: "첫 수업 준비",
        description: "처음 여는 수업의 순서를 차근차근 확인해요.",
        href: routes.page.dashboard.firstLesson(),
      },
      {
        id: "offline",
        label: "인터넷이 불안할 때",
        description: "연결이 끊겨도 수업을 이어갈 방법을 살펴봐요.",
        href: routes.page.dashboard.offline(),
      },
      {
        id: "import-board",
        label: "보드 가져오기",
        description: "다른 곳에서 만든 보드를 이곳으로 옮겨요.",
        href: routes.page.dashboard.import.board(),
      },
      {
        id: "import-padlet",
        label: "Padlet에서 가져오기",
        description: "사용하던 Padlet 보드를 이어서 써요.",
        href: routes.page.dashboard.import.padlet(),
      },
      {
        id: "import-recap",
        label: "Recap 가져오기",
        description: "저장해둔 Recap 수업 기록을 다시 불러와요.",
        href: routes.page.dashboard.import.recap(),
      },
      {
        id: "storage",
        label: "저장 공간",
        description: "남은 용량과 사용 중인 공간을 확인해요.",
        href: routes.page.dashboard.storage(),
      },
      {
        id: "system",
        label: "연결 상태 확인",
        description: "수업 전에 서비스 연결 상태를 점검해요.",
        href: routes.page.dashboard.system(),
      },
    ],
  },
  {
    id: "lab",
    title: "관리 도구",
    description: "운영 상태와 활동 기록이 필요할 때만 열어보세요.",
    collapsible: true,
    items: [
      {
        id: "ops",
        label: "운영 현황",
        description: "서비스 운영 상태를 한눈에 확인해요.",
        href: routes.page.dashboard.ops(),
        status: { label: "관리자", tone: "admin" },
        requiresAdmin: true,
      },
      {
        id: "audit",
        label: "활동 기록",
        description: "최근에 바뀐 내용과 작업 기록을 찾아봐요.",
        href: routes.page.dashboard.audit(),
        status: { label: "관리자", tone: "admin" },
        requiresAdmin: true,
      },
      {
        id: "diagnostics",
        label: "시스템 점검",
        description: "서비스가 제대로 연결됐는지 확인해요.",
        href: routes.page.dashboard.system(),
        status: { label: "관리자", tone: "admin" },
        requiresAdmin: true,
      },
      {
        id: "work-queue",
        label: "처리 대기 목록",
        description: "진행 중이거나 기다리는 작업을 확인해요.",
        href: routes.page.dashboard.opsWorkQueue(),
        status: { label: "관리자", tone: "admin" },
        requiresAdmin: true,
      },
    ],
  },
];
