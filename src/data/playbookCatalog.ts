export type PlaybookGroup = "H" | "GN8";
export type PlaybookFilter = "GN8";

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
  url: string;
  group: PlaybookGroup;
  cubeKey: string;
  thumbnailSrc?: string;
  fallbackThumbnailSrc?: string;
};

export const PLAYBOOK_CATALOG: readonly PlaybookItem[] = [
  {
    id: "H1",
    title: "워킹맘의 딜레마",
    url: "https://userstory-h-01.vercel.app/",
    group: "GN8",
    cubeKey: "0,4,3",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_WorkingMom.png",
  },
  {
    id: "H3",
    title: "우리의 세컨드는 실용 갑",
    url: "https://userstory-h-03.vercel.app/",
    group: "H",
    cubeKey: "2,4,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Setlog.png",
  },
  {
    id: "H4",
    title: "핸들을 놓기엔, 내 인생은 아직 주행 중",
    url: "https://userstory-h-04.vercel.app/",
    group: "H",
    cubeKey: "2,4,2",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Senior.png",
  },
  {
    id: "H5",
    title: "초보아빠가 차를 바꾼 101가지 이유",
    url: "https://userstory-h-05.vercel.app/",
    group: "H",
    cubeKey: "3,4,2",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_NoobDad.png",
  },
  {
    id: "H6",
    title: "댕댕이도 흔들리지 않는 편안함",
    url: "https://userstory-h-06.vercel.app/",
    group: "H",
    cubeKey: "4,4,2",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Puppy.png",
  },
  {
    id: "GN8-1",
    title: "내 차도 되나?",
    url: "https://userstory-gn8-01.vercel.app/",
    group: "GN8",
    cubeKey: "5,3,4",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Tech.png",
  },
  {
    id: "GN8-2",
    title: "나는 기능보다 SDV 철학이 궁금하다",
    url: "https://userstory-gn8-02.vercel.app/",
    group: "GN8",
    cubeKey: "5,2,1",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Blog.png",
  },
  {
    id: "GN8-3",
    title: "GN8 아는 척은 했고, 이제 배워야 한다",
    url: "https://userstory-gn8-03.vercel.app/",
    group: "GN8",
    cubeKey: "5,3,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Toon.png",
  },
  {
    id: "GN8-4",
    title: "차를 샀는데, AI가 따라왔다",
    url: "https://userstory-gn8-04.vercel.app/",
    group: "GN8",
    cubeKey: "4,3,4",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_AIKun.png",
  },
  {
    id: "GN8-6",
    title: "외산차를 정리하고 조용한 품격있는 국산차로",
    url: "https://userstory-gn8-06.vercel.app/",
    group: "GN8",
    cubeKey: "5,2,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Blind.png",
  },
  {
    id: "GN8-8",
    title: "가족에게는 두 번째 차, 나에게는 첫 번째 차",
    url: "https://userstory-gn8-08.vercel.app/",
    group: "GN8",
    cubeKey: "4,2,0",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Shorts.png",
  },
  {
    id: "GN8-13",
    title: "그 사진, 여기서 찍었었지",
    url: "https://userstory-gn8-13.vercel.app/",
    group: "GN8",
    cubeKey: "4,2,1",
    fallbackThumbnailSrc: "/assets/models/story%20thumbnail/T_Photo.png",
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
