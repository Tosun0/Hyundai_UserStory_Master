import { lazy, Suspense, useEffect, useState } from "react";
import type { AiChatSortRequest } from "../../data/aiChatSortConfig";
import type { PlaybookItem } from "../../data/playbookCatalog";
import type { ParallaxUnavailableReason } from "./parallaxTracking";
import { MinimalCubeLoader } from "../ui/MinimalCubeLoader";

const CubeMapScene = lazy(() => import("./CubeMapScene"));

type CubeScenePlaceholderProps = {
  enabled?: boolean;
  sceneActive?: boolean;
  chatSortRequest?: AiChatSortRequest | null;
  highlightRequestId?: number;
  exitOrbitViewRequestId?: number;
  axisIndexesVisible?: boolean;
  parallaxViewEnabled?: boolean;
  onOrbitViewChange?: (isOrbitView: boolean) => void;
  onParallaxViewUnavailable?: (reason: ParallaxUnavailableReason) => void;
  onOpenStoryDetail?: () => void;
  onOpenPlaybook?: (playbook: PlaybookItem) => void;
};

export function CubeScenePlaceholder({
  enabled = true,
  sceneActive = true,
  chatSortRequest = null,
  highlightRequestId = 0,
  exitOrbitViewRequestId = 0,
  axisIndexesVisible = false,
  parallaxViewEnabled = false,
  onOrbitViewChange,
  onParallaxViewUnavailable,
  onOpenStoryDetail,
  onOpenPlaybook,
}: CubeScenePlaceholderProps) {
  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => {
    if (enabled) {
      setIsSceneReady(false);
    }
  }, [enabled]);

  if (!enabled) {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        data-name="future-r3f-cube-scene-placeholder"
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <CubeMapScene
          chatSortRequest={chatSortRequest}
          highlightRequestId={highlightRequestId}
          exitOrbitViewRequestId={exitOrbitViewRequestId}
          axisIndexesVisible={axisIndexesVisible}
          sceneActive={sceneActive}
          parallaxViewEnabled={parallaxViewEnabled}
          onOrbitViewChange={onOrbitViewChange}
          onParallaxViewUnavailable={onParallaxViewUnavailable}
          onOpenStoryDetail={onOpenStoryDetail}
          onOpenPlaybook={onOpenPlaybook}
          onSceneReady={() => setIsSceneReady(true)}
        />
      </Suspense>
      {!isSceneReady ? (
        <MinimalCubeLoader variant="scene" dataName="cube-scene/loading-indicator" />
      ) : null}
    </>
  );
}
