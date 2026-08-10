import type { PlaybookFilter } from "./playbookCatalog";

export type AiChatSortStage = 1 | 2 | 3;

export type AiChatSortRequest = {
  requestId: number;
  stage: AiChatSortStage;
  filter?: PlaybookFilter;
};

export const aiChatSortConfig = {
  initialCandidateCubeKeys: [
    "1,0,5",
    "2,0,5",
    "3,0,5",
    "1,1,5",
    "2,1,5",
    "3,1,5",
    "1,2,5",
  ],
  secondStageCount: 3,
  finalStageCount: 1,
  aiReplies: [
    "어떤 연령대를 더 깊게 탐구해보실래요?",
    "좋아요. 원하는 국가가 있으신가요?",
    "검색을 완료했습니다.",
  ],
  quickPrompts: [],
  inputPlaceholder: "질문을 입력하세요.",
  thinkingAnimationSrc: "/assets/lottie/loading-dots-cropped.json",
  aiResponseDelayMs: 1000,
  thinkingDurationMs: 1500,
  typingIntervalMs: 32,
  punctuationPauseMs: 110,
} as const;
