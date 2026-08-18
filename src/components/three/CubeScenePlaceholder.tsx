import { lazy, Suspense, useEffect, useState } from "react";
import type { PlaybookGroup, PlaybookItem } from "../../data/playbookCatalog";
import type { ParallaxUnavailableReason } from "./parallaxTracking";
import type { CubeSceneCommand } from "./cubeSceneCommands";
import { MinimalCubeLoader } from "../ui/MinimalCubeLoader";

const CubeMapScene = lazy(() => import("./CubeMapScene"));

type CubeScenePlaceholderProps = {
  enabled?: boolean;
  sceneActive?: boolean;
  playbookGroup: PlaybookGroup;
  command?: CubeSceneCommand | null;
  axisIndexesVisible?: boolean;
  parallaxViewEnabled?: boolean;
  onOrbitViewChange?: (isOrbitView: boolean, playbook: PlaybookItem | null) => void;
  onParallaxViewUnavailable?: (reason: ParallaxUnavailableReason) => void;
  onOpenPlaybook?: (playbook: PlaybookItem) => void;
};

export function CubeScenePlaceholder({
  enabled = true,
  sceneActive = true,
  playbookGroup,
  command = null,
  axisIndexesVisible = false,
  parallaxViewEnabled = false,
  onOrbitViewChange,
  onParallaxViewUnavailable,
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
          playbookGroup={playbookGroup}
          command={command}
          axisIndexesVisible={axisIndexesVisible}
          sceneActive={sceneActive}
          parallaxViewEnabled={parallaxViewEnabled}
          onOrbitViewChange={onOrbitViewChange}
          onParallaxViewUnavailable={onParallaxViewUnavailable}
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
