import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { useState } from "react";
import { AnimatedButton } from "../ui/AnimatedButton";
import { ArrowGlyph } from "../ui/ArrowGlyph";
import {
  PlaybookLayoutView,
  type PlaybookLayoutMode,
} from "./PlaybookLayoutView";

type SearchScreenProps = {
  isActive?: boolean;
  playbookGroup: PlaybookAccessGroup;
  onLogout: () => void;
};

const layoutModes: readonly { id: PlaybookLayoutMode; label: string; shortLabel: string }[] = [
  { id: "constellation", label: "2.5D 콘스텔레이션", shortLabel: "콘스텔레이션" },
  { id: "ring", label: "그룹 오빗 링", shortLabel: "오빗 링" },
  { id: "matrix", label: "축 매트릭스", shortLabel: "매트릭스" },
];

export function SearchScreen({ isActive = true, playbookGroup, onLogout }: SearchScreenProps) {
  const [layoutMode, setLayoutMode] = useState<PlaybookLayoutMode>("constellation");

  const handleOpenPlaybook = (playbook: PlaybookItem) => {
    window.open(playbook.url, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      className={`screen-fill ${isActive ? "" : "pointer-events-none opacity-0"}`}
      data-node-id="15:88"
      data-name="02 Screen - Cube View Search"
      aria-hidden={!isActive}
    >
      <PlaybookLayoutView
        mode={layoutMode}
        playbookGroup={playbookGroup}
        onOpenPlaybook={handleOpenPlaybook}
      />

      <div className="screen-fill pointer-events-none z-10" data-name="layout-cube-map-ui">
        <AnimatedButton
          type="button"
          onClick={onLogout}
          className="gui-scale gui-origin-top-left pointer-events-auto absolute left-[calc(var(--safe-left)+32px)] top-[calc(var(--safe-top)+50px)] z-20 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2c2c2d] text-white backdrop-blur-[18.29px]"
          data-name="button/back-to-landing"
          aria-label="Back to access screen"
          title="Back to access screen"
        >
          <ArrowGlyph className="rotate-180" />
        </AnimatedButton>

        <div
          className="layout-mode-switcher gui-scale gui-origin-top-center pointer-events-auto absolute left-[var(--viewport-center-x)] top-[calc(var(--safe-top)+42px)] z-20 -translate-x-1/2"
          role="toolbar"
          aria-label="배치 방식 선택"
        >
          <span className="layout-mode-switcher__title">배치 방식</span>
          <div className="layout-mode-switcher__buttons">
            {layoutModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={layoutMode === mode.id ? "is-active" : ""}
                onClick={() => setLayoutMode(mode.id)}
                aria-pressed={layoutMode === mode.id}
                aria-label={mode.label}
              >
                <span className="layout-mode-switcher__full-label">{mode.label}</span>
                <span className="layout-mode-switcher__short-label">{mode.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
