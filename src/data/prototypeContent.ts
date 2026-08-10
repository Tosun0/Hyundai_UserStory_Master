export type ScreenId = "landing" | "search" | "detail";

export type ReactionId = "heart" | "like" | "fire" | "cry" | "surprised";

export type PollOptionId =
  | "childCrying"
  | "mirrorVisibility"
  | "climateWindowControl"
  | "suddenSafetyAction";

export type PrototypeAssetKey =
  | "logoUserStory"
  | "landingBg"
  | "searchBg"
  | "detailBg"
  | "storyDetailVideo"
  | "storySelectorHudBefore"
  | "storySelectorHudAfter"
  | "storySelectorMissionBox"
  | "storySelectorButtonADefault"
  | "storySelectorButtonASelect"
  | "storySelectorButtonBDefault"
  | "storySelectorButtonBSelect"
  | "cubeViewIcon"
  | "personIcon"
  | "secondaryIcon01"
  | "secondaryIcon02"
  | "backIcon"
  | "storyActionLeftIcon"
  | "storyActionRightIcon"
  | "radioEmptyIcon"
  | "engineerAvatar"
  | "floatingChatReference"
  | "storyDetailExtraFrame01"
  | "storyDetailExtraFrame01Scroll"
  | "storyDetailExtraFrame02";

export type CommentItem = {
  id: string;
  author: string;
  role: string;
  time: string;
  body: string;
  position: {
    x: number;
    y: number;
  };
  avatarType: "initials" | "image";
  initials?: string;
  isOwnedByCurrentUser?: boolean;
};

export type PollOption = {
  id: PollOptionId;
  label: string;
  resultPercent: number;
};

export type ReactionItem = {
  id: ReactionId;
  emoji: string;
  figmaName: string;
};

// 모든 이미지는 public/assets/figma 아래에 저장했습니다.
// Figma MCP의 임시 URL은 만료되므로, 앱에서는 반드시 이 로컬 경로만 사용합니다.
export const prototypeAssets: Record<PrototypeAssetKey, string> = {
  logoUserStory: "/assets/figma/logo-user-story.png",
  landingBg: "/assets/figma/landing-bg.png",
  searchBg: "/assets/figma/search-bg.png",
  detailBg: "/assets/figma/detail-bg.png",
  storyDetailVideo: "/assets/figma/S2C3.mp4",
  storySelectorHudBefore: "/assets/figma/selector/Mom%20HUD_before.png",
  storySelectorHudAfter: "/assets/figma/selector/Mom%20HUD_after.png",
  storySelectorMissionBox: "/assets/figma/selector/Mission%20Text%20Box.png",
  storySelectorButtonADefault: "/assets/figma/selector/Button%20A_default.png",
  storySelectorButtonASelect: "/assets/figma/selector/Button%20A_select.png",
  storySelectorButtonBDefault: "/assets/figma/selector/Button%20B_default.png",
  storySelectorButtonBSelect: "/assets/figma/selector/Button%20B_select.png",
  cubeViewIcon: "/assets/figma/icon-cube-view.svg",
  personIcon: "/assets/figma/icon-person.svg",
  secondaryIcon01: "/assets/figma/icon-secondary-01.svg",
  secondaryIcon02: "/assets/figma/icon-secondary-02.svg",
  backIcon: "/assets/figma/icon-back.svg",
  storyActionLeftIcon: "/assets/figma/icon-story-action-left.svg",
  storyActionRightIcon: "/assets/figma/icon-story-action-right.svg",
  radioEmptyIcon: "/assets/figma/icon-radio-empty.svg",
  engineerAvatar: "/assets/figma/avatar-engineer.png",
  floatingChatReference: "/assets/figma/floating-chat-reference.png",
  storyDetailExtraFrame01: "/assets/figma/2_Playbook_04_1.jpg",
  storyDetailExtraFrame01Scroll: "/assets/figma/2_Playbook_04_2.jpg",
  storyDetailExtraFrame02: "/assets/figma/story-detail-extra-frame-02.png",
};

export const prototypeText = {
  logoLabel: "User Story",
  landingButton: "GO",
  currentView: "Cube View",
  orbitTitle: "워킹맘",
  orbitStats: [
    { id: "views", icon: "visibility", label: "2.4천회" },
    { id: "comments", icon: "comment", label: "36개" },
    { id: "reactions", icon: "share_windows", label: "800회" },
  ],
  searchPlaceholder: "검색어 입력",
  searchTags: ["Ai 활용 기능", "워킹맘"],
  storyTitle: "워킹맘의 딜레마",
  storyStats: "조회수 2.4천회 | 댓글 38개",
  commentPlaceholder: "여러분의 경험을 댓글로 남겨주세요!",
  pollQuestion:
    "아이를 위해 열심히 달려왔지만, 문듯 좋은 부모 역할을 놓치고 있다는 생각이 들 때가 있습니다.",
  pollSubQuestion: "Q. 이 순간 가장 원했던 것은?",
  pollSubmit: "투표하기",
  pollDone: "투표 완료",
};

export const reactions: ReactionItem[] = [
  { id: "heart", emoji: "🩷", figmaName: "reaction/button-heart" },
  { id: "like", emoji: "👍", figmaName: "reaction/button-like" },
  { id: "fire", emoji: "🔥", figmaName: "reaction/button-fire" },
  { id: "cry", emoji: "😭", figmaName: "reaction/button-cry" },
  { id: "surprised", emoji: "😱", figmaName: "reaction/button-surprised" },
];

export const pollOptions: PollOption[] = [
  { id: "childCrying", label: "아이와 더 많은 시간을 보낼 수 있는 여유", resultPercent: 15 },
  { id: "mirrorVisibility", label: "짧아도 깊게 교감할 수 있는 방법", resultPercent: 45 },
  {
    id: "climateWindowControl",
    label: "일과 육아를 모두 놓치지 않는 환경",
    resultPercent: 5,
  },
  {
    id: "suddenSafetyAction",
    label: "좋은 부모라는 확신과 안도감",
    resultPercent: 35,
  },
];

export const initialComments: CommentItem[] = [
  {
    id: "ux-researcher",
    author: "박소연",
    role: "UX 리서처",
    time: "오전 10:30",
    position: { x: 528, y: 440 },
    avatarType: "initials",
    initials: "SY",
    body: `물리적으로 함께할 수 없는 시간을 기술이 얼마나 보완할 수 있을지가 앞으로 중요한 과제가 될 것 같습니다.`,
  },
  {
    id: "engineer",
    author: "이현준",
    role: "엔지니어",
    time: "오후 12:15",
    position: { x: 81, y: 683 },
    avatarType: "image",
    body: "결국 워킹맘이 원하는 건 더 많은 시간이 아니라, 제한된 시간 안에서도 좋은 부모라고 느낄 수 있는 확신인 것 같습니다.",
  },
];
