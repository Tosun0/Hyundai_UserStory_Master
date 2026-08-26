import type { AiChatSortRequest } from "../../data/aiChatSortConfig";
import type { PlaybookAccessGroup } from "../../data/playbookCatalog";

export type CubeSceneCommandPayload =
  | { type: "set-playbook-group"; group: PlaybookAccessGroup }
  | { type: "chat-sort"; request: AiChatSortRequest | null }
  | { type: "highlight-random" }
  | { type: "clear-highlight" }
  | { type: "exit-orbit" }
  | { type: "reset-map" };

export type CubeSceneCommand = CubeSceneCommandPayload & {
  id: number;
};
