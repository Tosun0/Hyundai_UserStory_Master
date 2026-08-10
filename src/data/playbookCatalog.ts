export type PlaybookGroup = "H" | "GN8";
export type PlaybookFilter = "GN8";

export type PlaybookId =
  | "H3"
  | "H4"
  | "H5"
  | "H6"
  | "GN8-1"
  | "GN8-4"
  | "GN8-6"
  | "GN8-8";

export type PlaybookItem = {
  id: PlaybookId;
  title: string;
  url: string;
  group: PlaybookGroup;
  thumbnailSrc: string;
  cubeKey: string;
};

export const PLAYBOOK_CATALOG: readonly PlaybookItem[] = [
  {
    id: "H3",
    title: "우리의 세컨드는 실용 갑",
    url: "https://hyundai-user-story-17px.vercel.app/?v=4dd7e9c",
    group: "H",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_001.png",
    cubeKey: "2,4,0",
  },
  {
    id: "H4",
    title: "핸들을 놓기엔, 내 인생은 아직 주행 중",
    url: "https://hyundai-user-story-16px.vercel.app/",
    group: "H",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_002.png",
    cubeKey: "2,4,2",
  },
  {
    id: "H5",
    title: "초보아빠가 차를 바꾼 101가지 이유",
    url: "https://hyundai-user-story-20px.vercel.app/",
    group: "H",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_003.png",
    cubeKey: "3,4,2",
  },
  {
    id: "H6",
    title: "댕댕이도 흔들리지 않는 편안함",
    url: "https://playbook-test-game.vercel.app/",
    group: "H",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_004.png",
    cubeKey: "4,4,2",
  },
  {
    id: "GN8-1",
    title: "내 차도 되나?",
    url: "https://userstorygn803.vercel.app/",
    group: "GN8",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_005.png",
    cubeKey: "5,3,4",
  },
  {
    id: "GN8-4",
    title: "차를 샀는데, AI가 따라왔다",
    url: "https://userstorygn804.vercel.app/",
    group: "GN8",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_006.png",
    cubeKey: "4,3,4",
  },
  {
    id: "GN8-6",
    title: "의식된 예의에서 조용한 품격으로",
    url: "https://userstorygn802.vercel.app/",
    group: "GN8",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_001.png",
    cubeKey: "5,2,0",
  },
  {
    id: "GN8-8",
    title: "가족의 두번째 차, 나의 첫번째 차",
    url: "https://userstorygn801.vercel.app/",
    group: "GN8",
    thumbnailSrc: "/assets/models/story%20thumbnail/story%20thumbnail_002.png",
    cubeKey: "4,2,0",
  },
];

export function getPlaybookByCubeKey(cubeKey: string) {
  return PLAYBOOK_CATALOG.find((playbook) => playbook.cubeKey === cubeKey) ?? null;
}

export function getPlaybooksByFilter(filter: PlaybookFilter) {
  return PLAYBOOK_CATALOG.filter((playbook) => playbook.group === filter);
}
