import type { AiChatSortRequest } from "../../data/aiChatSortConfig";
import type { PlaybookGroup } from "../../data/playbookCatalog";

export type CubeSceneCommandPayload =
  | { type: "set-playbook-group"; group: PlaybookGroup }
  | { type: "chat-sort"; request: AiChatSortRequest | null }
  | { type: "highlight-random" }
  | { type: "clear-highlight" }
  | { type: "exit-orbit" }
  | { type: "reset-map" };

export type CubeSceneCommand = CubeSceneCommandPayload & {
  id: number;
};
