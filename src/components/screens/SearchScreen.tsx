import { useEffect, useState } from "react";
import {
  type AiChatSortRequest,
  type AiChatSortStage,
} from "../../data/aiChatSortConfig";
import type { PlaybookFilter, PlaybookItem } from "../../data/playbookCatalog";
import { prototypeText } from "../../data/prototypeContent";
import { CubeScenePlaceholder } from "../three/CubeScenePlaceholder";
import { cubeSceneTheme } from "../three/cubeSceneTheme";
import { AiChatSortPanel } from "./AiChatSortPanel";
import { AnimatedButton } from "../ui/AnimatedButton";
import { ArrowGlyph } from "../ui/ArrowGlyph";

type SearchScreenProps = {
  isActive?: boolean;
};

function getOrbitStatWidthClass(id: string) {
  if (id === "comments") {
    return "w-[64px]";
  }

  if (id === "reactions") {
    return "w-[69px]";
  }

  return "w-[79px]";
}

const cubeMapTopNavItems = [
  {
    label: "Cube View",
    iconSrc: "/assets/figma/nav-1929-cube-view-symbol.svg",
    nodeId: "1929:1060",
    dataName: "nav/current-view-tab - Cube View",
    isActive: true,
  },
  {
    iconSrc: "/assets/figma/nav-1929-person-fill.svg",
    nodeId: "1929:1064",
    dataName: "nav/icon-button - profile",
    isActive: false,
  },
  {
    iconSrc: "/assets/figma/nav-1929-secondary-action-01.svg",
    nodeId: "1929:1066",
    dataName: "nav/icon-button - secondary-action-01",
    isActive: false,
  },
  {
    iconSrc: "/assets/figma/nav-1929-secondary-action-02.svg",
    nodeId: "1929:1069",
    dataName: "nav/icon-button - secondary-action-02",
    isActive: false,
  },
] as const;

export function SearchScreen({ isActive = true }: SearchScreenProps) {
  const [chatSortRequest, setChatSortRequest] = useState<AiChatSortRequest | null>(null);
  const [chatPanelResetId, setChatPanelResetId] = useState(0);
  const [clearHighlightRequestId, setClearHighlightRequestId] = useState(0);
  const [exitOrbitViewRequestId, setExitOrbitViewRequestId] = useState(0);
  const [areAxisIndexesVisible, setAreAxisIndexesVisible] = useState(false);
  const [isOrbitView, setIsOrbitView] = useState(false);
  const [focusedPlaybook, setFocusedPlaybook] = useState<PlaybookItem | null>(null);
  const [isParallaxViewEnabled, setIsParallaxViewEnabled] = useState<boolean>(
    () => cubeSceneTheme.orbitView.parallax.defaultEnabled,
  );

  useEffect(() => {
    if (!isOrbitView) {
      setIsParallaxViewEnabled(cubeSceneTheme.orbitView.parallax.defaultEnabled);
    }
  }, [isOrbitView]);

  const handleSortStageComplete = (stage: AiChatSortStage, filter?: PlaybookFilter) => {
    setChatSortRequest((currentRequest) => ({
      requestId: (currentRequest?.requestId ?? 0) + 1,
      stage,
      filter,
    }));
  };

  const handleOpenPlaybook = (playbook: PlaybookItem) => {
    window.open(playbook.url, "_blank", "noopener,noreferrer");
  };

  const handleOrbitViewChange = (isActive: boolean, playbook: PlaybookItem | null) => {
    setIsOrbitView(isActive);
    setFocusedPlaybook(isActive ? playbook : null);
  };

  const handleBackToCubeMap = () => {
    setChatSortRequest(null);
    setChatPanelResetId((resetId) => resetId + 1);
    setClearHighlightRequestId((requestId) => requestId + 1);
    setExitOrbitViewRequestId((requestId) => requestId + 1);
  };

  return (
    <section
      className={`screen-fill ${isActive ? "" : "pointer-events-none opacity-0"}`}
      data-node-id="15:88"
      data-name="02 Screen - Cube View Search"
      aria-hidden={!isActive}
    >
      <CubeScenePlaceholder
        sceneActive={isActive}
        chatSortRequest={chatSortRequest}
        clearHighlightRequestId={clearHighlightRequestId}
        exitOrbitViewRequestId={exitOrbitViewRequestId}
        axisIndexesVisible={areAxisIndexesVisible}
        parallaxViewEnabled={isActive && isOrbitView && isParallaxViewEnabled}
        onOrbitViewChange={handleOrbitViewChange}
        onParallaxViewUnavailable={() => setIsParallaxViewEnabled(false)}
        onOpenPlaybook={handleOpenPlaybook}
      />

      {isOrbitView ? (
        <>
          <header
            className="gui-scale gui-origin-top-center pointer-events-none absolute left-[var(--viewport-center-x)] top-[max(calc(var(--safe-top)+96px),calc(var(--viewport-center-y)-720px))] z-20 flex h-[102px] w-max max-w-[calc(var(--viewport-width)-64px)] -translate-x-1/2 flex-col items-center text-white"
            data-name="header/orbit-story-summary"
            aria-label={focusedPlaybook?.title ?? "Cube View"}
          >
            <div
              className="flex min-h-[48px] w-max max-w-full items-center justify-center rounded-full bg-[#d0d0d0] px-[22px] py-[6px] text-center text-[32px] font-bold leading-[1.25] tracking-[-0.32px] text-[#333333]"
              data-name="header/orbit-story-title-pill"
            >
              {focusedPlaybook?.title ?? "Cube View"}
            </div>

            <div
              className="mt-[30px] flex h-[24px] w-[242px] items-center gap-[15px]"
              data-name="header/orbit-story-stats"
            >
              {prototypeText.orbitStats.map((stat) => (
                <div
                  key={stat.id}
                  className={`flex h-[24px] items-center gap-[6px] ${getOrbitStatWidthClass(stat.id)}`}
                  data-name={`header/orbit-stat-${stat.id}`}
                >
                  <span
                    className="material-symbols-outlined orbit-stat-symbol"
                    aria-hidden="true"
                  >
                    {stat.icon}
                  </span>
                  <span className="whitespace-nowrap text-center text-[16px] font-semibold leading-[1.5] tracking-[-0.16px] text-black/80">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </header>

          <AnimatedButton
            type="button"
            onClick={handleBackToCubeMap}
            className="gui-scale gui-origin-top-left absolute left-[calc(var(--safe-left)+32px)] top-[calc(var(--safe-top)+32px)] z-20 flex h-[54px] items-center justify-center gap-[8px] rounded-full bg-[#2c2c2d] px-[22px] text-[20px] font-medium leading-[1.5] text-white backdrop-blur-[18.29px]"
            data-name="button/back-to-cube-map"
            aria-label="Back to cube map"
            title="Back to cube map"
          >
            <ArrowGlyph className="rotate-180" />
            <span>Back</span>
          </AnimatedButton>

          <AnimatedButton
            type="button"
            onClick={() => setIsParallaxViewEnabled((isEnabled) => !isEnabled)}
            className="gui-scale gui-origin-top-right absolute left-[calc(var(--safe-right)-86px)] top-[calc(var(--safe-top)+32px)] z-20 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2c2c2d] text-white backdrop-blur-[18.29px]"
            data-name="button/orbit-parallax-toggle"
            aria-label={isParallaxViewEnabled ? "Disable HeadTrack" : "Enable HeadTrack"}
            aria-pressed={isParallaxViewEnabled}
            title={isParallaxViewEnabled ? "Disable HeadTrack" : "Enable HeadTrack"}
          >
            <span
              className="material-symbols-outlined orbit-parallax-toggle-symbol"
              aria-hidden="true"
            >
              {isParallaxViewEnabled ? "visibility" : "visibility_off"}
            </span>
          </AnimatedButton>

        </>
      ) : (
        <>
          <nav
            className="gui-scale gui-origin-top-center cube-top-bar-scroll absolute left-[var(--viewport-center-x)] top-[calc(var(--safe-top)+44px)] z-10 w-max max-w-[calc(var(--viewport-width)-32px)] -translate-x-1/2 overflow-x-auto rounded-full p-[6px] backdrop-blur-[35px] [scrollbar-width:none]"
            data-node-id="1929:1058"
            data-name="nav/cube-view-top-bar"
            aria-label="Cube View top menu"
          >
            <div className="flex w-max items-center justify-center gap-[5.486px]">
              {cubeMapTopNavItems.map((item) => (
                <AnimatedButton
                  key={item.nodeId}
                  type="button"
                  onClick={item.isActive ? handleBackToCubeMap : undefined}
                  className={`flex h-[54px] shrink-0 items-center justify-center rounded-[40.229px] px-[20px] py-[12px] backdrop-blur-[18.286px] ${
                    item.isActive ? "bg-[#2c2c2d] text-white" : "bg-white text-[#2c2c2d]"
                  } ${item.isActive ? "gap-[6px]" : ""}`}
                  data-node-id={item.nodeId}
                  data-name={item.dataName}
                  aria-current={item.isActive ? "page" : undefined}
                >
                  <img src={item.iconSrc} alt="" className="h-[24px] w-[24px]" />
                  {"label" in item ? (
                    <span className="whitespace-nowrap text-[22px] font-medium leading-[1.5] tracking-[-0.22px]">
                      {item.label}
                    </span>
                  ) : null}
                </AnimatedButton>
              ))}
            </div>
          </nav>

          <AiChatSortPanel
            key={chatPanelResetId}
            onSortStageComplete={handleSortStageComplete}
            onToggleAxisIndexes={() =>
              setAreAxisIndexesVisible((isVisible) => !isVisible)
            }
          />
        </>
      )}
    </section>
  );
}
