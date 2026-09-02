import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PlaybookAccessGroup,
  PlaybookItem,
} from "../../data/playbookCatalog";
import { prototypeText } from "../../data/prototypeContent";
import { CubeScenePlaceholder } from "../three/CubeScenePlaceholder";
import type {
  CubeSceneCommand,
  CubeSceneCommandPayload,
} from "../three/cubeSceneCommands";
import { cubeSceneTheme } from "../three/cubeSceneTheme";
import {
  PlaybookLayoutView,
  type PlaybookLayoutMode,
} from "./PlaybookLayoutView";
import { AnimatedButton } from "../ui/AnimatedButton";
import { ArrowGlyph } from "../ui/ArrowGlyph";

type SearchScreenProps = {
  isActive?: boolean;
  playbookGroup: PlaybookAccessGroup;
  comparisonMode?: boolean;
  onLogout: () => void;
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

const layoutModes: readonly { id: PlaybookLayoutMode; label: string; shortLabel: string }[] = [
  { id: "solar", label: "Solar Burst", shortLabel: "Solar" },
  { id: "index", label: "Story Index", shortLabel: "Index" },
  { id: "tunnel", label: "Deep Space Tunnel", shortLabel: "Tunnel" },
  { id: "timeline", label: "Timeline Rail", shortLabel: "Rail" },
  { id: "orbit", label: "Orbit Rings", shortLabel: "Orbit" },
  { id: "focus", label: "Focus Stack", shortLabel: "Focus" },
];

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

export function SearchScreen({
  isActive = true,
  playbookGroup,
  comparisonMode = false,
  onLogout,
}: SearchScreenProps) {
  const [cubeCommand, setCubeCommand] = useState<CubeSceneCommand | null>(null);
  const resetSceneRef = useRef<(() => void) | null>(null);
  const commandIdRef = useRef(0);
  const [isOrbitView, setIsOrbitView] = useState(false);
  const [focusedPlaybook, setFocusedPlaybook] = useState<PlaybookItem | null>(null);
  const [isParallaxViewEnabled, setIsParallaxViewEnabled] = useState<boolean>(
    () => cubeSceneTheme.orbitView.parallax.defaultEnabled,
  );
  const [layoutMode, setLayoutMode] = useState<PlaybookLayoutMode>("solar");
  const [comparisonCubeView, setComparisonCubeView] = useState(false);
  const isCubeView = !comparisonMode || comparisonCubeView;

  useEffect(() => {
    if (!isOrbitView) {
      setIsParallaxViewEnabled(cubeSceneTheme.orbitView.parallax.defaultEnabled);
    }
  }, [isOrbitView]);

  useEffect(() => {
    if (isCubeView) {
      dispatchCubeCommand({
        type: "set-playbook-group",
        group: comparisonMode ? "ALL" : playbookGroup,
      });
    }
  }, [comparisonMode, isCubeView, playbookGroup]);

  const dispatchCubeCommand = useCallback((payload: CubeSceneCommandPayload) => {
    commandIdRef.current += 1;
    setCubeCommand({ ...payload, id: commandIdRef.current });
  }, []);

  const handleOpenPlaybook = (playbook: PlaybookItem) => {
    window.open(playbook.url, "_blank", "noopener,noreferrer");
  };

  const handleOrbitViewChange = (isActive: boolean, playbook: PlaybookItem | null) => {
    setIsOrbitView(isActive);
    if (isActive && playbook) {
      setFocusedPlaybook(playbook);
    }
  };

  const handleBackToCubeMap = () => {
    dispatchCubeCommand({ type: "reset-map" });
  };

  const handleLogout = useCallback(() => {
    resetSceneRef.current?.();
    setIsOrbitView(false);
    setFocusedPlaybook(null);
    setComparisonCubeView(false);
    onLogout();
  }, [onLogout]);

  return (
    <section
      className={`screen-fill ${isActive ? "" : "pointer-events-none opacity-0"}`}
      data-node-id="15:88"
      data-name="02 Screen - Cube View Search"
      aria-hidden={!isActive}
    >
      {isCubeView ? (
        <CubeScenePlaceholder
          sceneActive={isActive}
          command={cubeCommand}
          playbookGroup={comparisonMode ? "ALL" : playbookGroup}
          parallaxViewEnabled={isActive && isOrbitView && isParallaxViewEnabled}
          onOrbitViewChange={handleOrbitViewChange}
          onParallaxViewUnavailable={() => setIsParallaxViewEnabled(false)}
          onOpenPlaybook={handleOpenPlaybook}
          resetSceneRef={resetSceneRef}
        />
      ) : (
        <PlaybookLayoutView
          mode={layoutMode}
          playbookGroup="ALL"
          onOpenPlaybook={handleOpenPlaybook}
        />
      )}

      <div
        className={`screen-fill pointer-events-none z-10 transition-[opacity,filter] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOrbitView ? "opacity-0 blur-[3px]" : "opacity-100 blur-0"
        }`}
        data-name="layout/cube-map-ui"
        aria-hidden={isOrbitView}
      >
        <AnimatedButton
          type="button"
          onClick={handleLogout}
          className="gui-scale gui-origin-top-left pointer-events-auto absolute left-[calc(var(--safe-left)+32px)] top-[calc(var(--safe-top)+50px)] z-20 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2c2c2d] text-white backdrop-blur-[18.29px]"
          data-name="button/back-to-landing"
          aria-label="Back to access screen"
          title="Back to access screen"
        >
          <ArrowGlyph className="rotate-180" />
        </AnimatedButton>

        {comparisonMode && !comparisonCubeView ? (
          <div
            className="layout-mode-switcher gui-scale gui-origin-bottom-center pointer-events-auto absolute bottom-[calc(var(--viewport-height)-var(--safe-bottom)+24px)] left-[var(--viewport-center-x)] top-auto z-20 max-w-[calc(var(--viewport-width)-32px)] -translate-x-1/2 overflow-x-auto [scrollbar-width:none]"
            role="toolbar"
            aria-label="배치 방식 선택"
          >
            <div className="layout-mode-switcher__buttons">
              <button
                type="button"
                className="layout-mode-switcher__cube-button"
                onClick={() => setComparisonCubeView(true)}
                aria-label="3D Cube View 보기"
              >
                <span className="material-symbols-outlined" aria-hidden="true">view_in_ar</span>
                Cube View
              </button>
              <label className="layout-mode-switcher__select-wrap">
                <span className="layout-mode-switcher__title">배치 방식</span>
                <select
                  className="layout-mode-switcher__select"
                  value={layoutMode}
                  onChange={(event) => setLayoutMode(event.target.value as PlaybookLayoutMode)}
                  aria-label="비교 배치 방식"
                >
                  {layoutModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                </select>
                <span className="material-symbols-outlined layout-mode-switcher__select-icon" aria-hidden="true">expand_more</span>
              </label>
            </div>
          </div>
        ) : isCubeView ? (
          <nav
            className="gui-scale gui-origin-top-center cube-top-bar-scroll pointer-events-auto absolute left-[var(--viewport-center-x)] top-[calc(var(--safe-top)+44px)] z-10 w-max max-w-[calc(var(--viewport-width)-32px)] -translate-x-1/2 overflow-x-auto rounded-full p-[6px] backdrop-blur-[35px] [scrollbar-width:none]"
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
        ) : null}

      </div>

      {comparisonMode && comparisonCubeView && !isOrbitView ? (
        <div className="pointer-events-none absolute left-[var(--viewport-center-x)] top-[calc(var(--safe-top)+42px)] z-20 -translate-x-1/2">
          <button
            type="button"
            className="layout-mode-switcher layout-mode-switcher__cube-return pointer-events-auto"
            onClick={() => setComparisonCubeView(false)}
            aria-label="비교 배치로 돌아가기"
          >
            <span className="material-symbols-outlined" aria-hidden="true">view_quilt</span>
            비교 배치
          </button>
        </div>
      ) : null}

      {isCubeView ? (
        <div className="screen-fill pointer-events-none z-20" data-name="layout/orbit-ui">
          <header
            className={`gui-origin-top-center pointer-events-none absolute left-[var(--viewport-center-x)] top-[max(calc(var(--safe-top)+96px),calc(var(--viewport-center-y)-720px))] z-20 flex h-[102px] w-max max-w-[calc(var(--viewport-width)-64px)] -translate-x-1/2 flex-col items-center text-white transition-[opacity,filter] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isOrbitView
                ? "delay-[100ms] opacity-100 blur-0"
                : "delay-0 opacity-0 blur-[3px]"
            }`}
            data-name="header/orbit-story-summary"
            aria-label={focusedPlaybook?.title ?? "Cube View"}
            aria-hidden={!isOrbitView}
          >
            <div
              className="flex min-h-[48px] w-max max-w-full items-center justify-center rounded-[999px] border border-[rgb(15_23_42_/_0.12)] bg-[rgb(255_255_255_/_0.88)] px-[28px] py-[10px] text-center text-[clamp(18px,1.6vw,24px)] font-extrabold leading-[1.2] tracking-[-0.025em] text-[#0f172a] shadow-[0_8px_24px_rgb(0_0_0_/_0.12)] backdrop-blur-[16px]"
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

          <div
            className={`absolute left-[calc(var(--safe-left)+32px)] top-[calc(var(--safe-top)+50px)] z-20 origin-left transition-[opacity,scale,translate] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isOrbitView
                ? "pointer-events-auto delay-[100ms] translate-x-0 scale-100 opacity-100"
                : "pointer-events-none delay-0 -translate-x-[8px] scale-[0.9] opacity-0"
            }`}
          >
            <AnimatedButton
              type="button"
              onClick={handleBackToCubeMap}
              className="gui-scale gui-origin-top-left flex h-[54px] items-center justify-center gap-[8px] rounded-full bg-[#2c2c2d] px-[22px] text-[20px] font-medium leading-[1.5] text-white backdrop-blur-[18.29px]"
              data-name="button/back-to-cube-map"
              aria-label="Back to cube map"
              title="Back to cube map"
            >
              <ArrowGlyph className="rotate-180" />
              <span>Back</span>
            </AnimatedButton>
          </div>

          <div
            className={`absolute left-[calc(var(--safe-right)-86px)] top-[calc(var(--safe-top)+32px)] z-20 origin-right transition-[opacity,scale] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isOrbitView
                ? "pointer-events-auto delay-[100ms] scale-100 opacity-100"
                : "pointer-events-none delay-0 scale-[0.92] opacity-0"
            }`}
          >
            {/* Camera permission request is intentionally disabled for the prototype. */}
            <AnimatedButton
              type="button"
              className="gui-scale gui-origin-top-right flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2c2c2d] text-white backdrop-blur-[18.29px]"
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
