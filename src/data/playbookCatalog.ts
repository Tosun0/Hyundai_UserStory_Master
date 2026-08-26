export type PlaybookGroup = "H" | "GN8";
export type PlaybookAccessGroup = PlaybookGroup | "ALL";
export type PlaybookFilter = PlaybookGroup;

export type PlaybookId =
  | "H1"
  | "H3"
  | "H4"
  | "H5"
  | "H6"
  | "GN8-1"
  | "GN8-2"
  | "GN8-3"
  | "GN8-4"
  | "GN8-6"
  | "GN8-8"
  | "GN8-13";

export type PlaybookItem = {
  id: PlaybookId;
  title: string;
  description: string;
  tags: readonly string[];
  url: string;
  group: PlaybookGroup;
  cubeKey: string;
  thumbnailSrc?: string;
  fallbackThumbnailSrc?: string;
};

export type PlaybookTooltipData = Pick<PlaybookItem, "title" | "description" | "tags">;

export const PLAYBOOK_CATALOG: readonly PlaybookItem[] = [
  {
    id: "H1",
    title: "워킹맘의 딜레마",
    description: "바쁜 하루 속 가족과 나의 균형을 다시 생각합니다.",
    tags: ["가족", "일상"],
    url: "https://userstory-h-01.vercel.app/",
    group: "H",
    cubeKey: "0,4,3",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_WorkingMom.png",
  },
  {
    id: "H3",
    title: "우리의 세컨드는 실용 갑",
    description: "한 대의 차로는 채우기 어려운 가족의 하루를 봅니다.",
    tags: ["세컨드카", "실용"],
    url: "https://userstory-h-03.vercel.app/",
    group: "H",
    cubeKey: "2,4,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Setlog.png",
  },
  {
    id: "H4",
    title: "핸들을 놓기엔, 내 인생은 아직 주행 중",
    description: "익숙한 이동을 오래 편안하게 이어가는 방법을 찾습니다.",
    tags: ["시니어", "안심"],
    url: "https://userstory-h-04.vercel.app/",
    group: "H",
    cubeKey: "2,4,2",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Senior.png",
  },
  {
    id: "H5",
    title: "초보아빠가 차를 바꾼 101가지 이유",
    description: "아이와 함께 움직이는 가족의 현실적인 선택을 담았습니다.",
    tags: ["패밀리카", "육아"],
    url: "https://userstory-h-05.vercel.app/",
    group: "H",
    cubeKey: "3,4,2",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_NoobDad.png",
  },
  {
    id: "H6",
    title: "댕댕이도 흔들리지 않는 편안함",
    description: "반려견과 함께하는 이동의 불편을 편안함으로 바꿉니다.",
    tags: ["반려견", "편안함"],
    url: "https://userstory-h-06.vercel.app/",
    group: "H",
    cubeKey: "4,4,2",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Puppy.png",
  },
  {
    id: "GN8-1",
    title: "내 차도 되나?",
    description: "새로운 기능을 발견하고 익히는 즐거움을 따라갑니다.",
    tags: ["신기능", "발견"],
    url: "https://userstory-gn8-01.vercel.app/",
    group: "GN8",
    cubeKey: "5,3,4",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Tech.png",
  },
  {
    id: "GN8-2",
    title: "나는 기능보다 SDV 철학이 궁금하다",
    description: "기능을 넘어 자동차를 만든 생각과 철학을 살펴봅니다.",
    tags: ["SDV", "철학"],
    url: "https://userstory-gn8-02.vercel.app/",
    group: "GN8",
    cubeKey: "5,2,1",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Blog.png",
  },
  {
    id: "GN8-3",
    title: "GN8 아는 척은 했고, 이제 배워야 한다",
    description: "낯선 기능을 내 것으로 만드는 배움의 순간을 담았습니다.",
    tags: ["학습", "기술"],
    url: "https://userstory-gn8-03.vercel.app/",
    group: "GN8",
    cubeKey: "5,3,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Toon.png",
  },
  {
    id: "GN8-4",
    title: "차를 샀는데, AI가 따라왔다",
    description: "자동차와 AI가 서로를 알아가는 과정을 상상합니다.",
    tags: ["AI", "개인화"],
    url: "https://userstory-gn8-04.vercel.app/",
    group: "GN8",
    cubeKey: "4,3,4",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_AIKun.png",
  },
  {
    id: "GN8-6",
    title: "외산차를 정리하고 조용한 품격있는 국산차로",
    description: "보여주지 않아도 오래 남는 자동차의 품격을 이야기합니다.",
    tags: ["품격", "취향"],
    url: "https://userstory-gn8-06.vercel.app/",
    group: "GN8",
    cubeKey: "5,2,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Blind.png",
  },
  {
    id: "GN8-8",
    title: "가족에게는 두 번째 차, 나에게는 첫 번째 차",
    description: "두 번째 차를 고르는 기준과 가족의 생활을 연결합니다.",
    tags: ["선택", "가족"],
    url: "https://userstory-gn8-08.vercel.app/",
    group: "GN8",
    cubeKey: "4,2,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Shorts.png",
  },
  {
    id: "GN8-13",
    title: "그 사진, 여기서 찍었었지",
    description: "한 장의 사진에서 시작된 기억과 이동의 장면을 기록합니다.",
    tags: ["사진", "기억"],
    url: "https://userstory-gn8-13.vercel.app/",
    group: "GN8",
    cubeKey: "4,2,1",
    thumbnailSrc: "/assets/models/story%20thumbnail/T_Photo.png",
  },
];

export function getPlaybookThumbnailSrc(playbook: Pick<PlaybookItem, "url" | "thumbnailSrc">) {
  return playbook.thumbnailSrc ?? `/api/playbook-thumbnail?url=${encodeURIComponent(playbook.url)}`;
}

export function getPlaybookFallbackThumbnailSrc(
  playbook: Pick<PlaybookItem, "fallbackThumbnailSrc">,
) {
  return playbook.fallbackThumbnailSrc ?? null;
}

export function getPlaybookByCubeKey(cubeKey: string) {
  return PLAYBOOK_CATALOG.find((playbook) => playbook.cubeKey === cubeKey) ?? null;
}

export function getPlaybooksByFilter(filter: PlaybookFilter) {
  return PLAYBOOK_CATALOG.filter((playbook) => playbook.group === filter);
}
