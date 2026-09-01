import { useState, type CSSProperties } from "react";
import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

export type PlaybookLayoutMode = "constellation" | "ring" | "matrix";

type PlaybookLayoutViewProps = {
  mode: PlaybookLayoutMode;
  playbookGroup: PlaybookAccessGroup;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
};

const constellationOffsets = [
  [-350, -185],
  [-88, -265],
  [220, -220],
  [-410, 74],
  [-110, 42],
  [210, 36],
  [-325, 285],
  [-50, 260],
  [255, 245],
  [420, -48],
  [420, 210],
  [-510, -110],
] as const;

const matrixColumnLabels = ["0", "1", "2", "3", "4", "5"];
const matrixRowLabels = ["0", "1", "2", "3", "4", "5"];

function getVisiblePlaybooks(group: PlaybookAccessGroup) {
  return group === "ALL"
    ? PLAYBOOK_CATALOG
    : PLAYBOOK_CATALOG.filter((playbook) => playbook.group === group);
}

function CubeCore({ activeTitle }: { activeTitle?: string }) {
  return (
    <div className={`layout-cube-core ${activeTitle ? "is-active" : ""}`} aria-hidden="true">
      <div className="layout-cube-core__cube">
        <div className="layout-cube-core__face layout-cube-core__face--front" />
        <div className="layout-cube-core__face layout-cube-core__face--back" />
        <div className="layout-cube-core__face layout-cube-core__face--right" />
        <div className="layout-cube-core__face layout-cube-core__face--left" />
        <div className="layout-cube-core__face layout-cube-core__face--top" />
        <div className="layout-cube-core__face layout-cube-core__face--bottom" />
      </div>
      <div className="layout-cube-core__caption">CUBE VIEW</div>
      {activeTitle ? <div className="layout-cube-core__active-label">{activeTitle}</div> : null}
    </div>
  );
}

function PlaybookCard({
  playbook,
  onOpenPlaybook,
  onHover,
  className = "",
  style,
}: {
  playbook: PlaybookItem;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
  onHover: (playbook: PlaybookItem | null) => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className={`layout-playbook-card ${className}`}
      style={style}
      onClick={() => onOpenPlaybook(playbook)}
      onMouseEnter={() => onHover(playbook)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(playbook)}
      onBlur={() => onHover(null)}
      aria-label={`${playbook.id} ${playbook.title} 열기`}
    >
      <span className="layout-playbook-card__depth" aria-hidden="true" />
      <span className="layout-playbook-card__face">
        <img src={playbook.fallbackThumbnailSrc ?? playbook.thumbnailSrc ?? ""} alt="" />
        <span className="layout-playbook-card__body">
          <span className="layout-playbook-card__meta">
            <span>{playbook.id}</span>
            <span>{playbook.cubeKey}</span>
          </span>
          <strong>{playbook.title}</strong>
          <span className="layout-playbook-card__tags">
            {playbook.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </span>
        </span>
        <span className="layout-playbook-card__arrow" aria-hidden="true">
          ↗
        </span>
      </span>
    </button>
  );
}

function ConstellationLayout({
  playbooks,
  hoveredPlaybook,
  onHover,
  onOpenPlaybook,
}: {
  playbooks: readonly PlaybookItem[];
  hoveredPlaybook: PlaybookItem | null;
  onHover: (playbook: PlaybookItem | null) => void;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
}) {
  return (
    <div className={`layout-constellation ${hoveredPlaybook ? "has-hover" : ""}`}>
      <div className="layout-constellation__hint">마우스를 올려 이야기를 발견해보세요</div>
      <CubeCore activeTitle={hoveredPlaybook?.title} />
      <div className="layout-constellation__cards">
        {playbooks.map((playbook, index) => {
          const [x, y] = constellationOffsets[index % constellationOffsets.length];
          return (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              className={`layout-constellation__card ${
                hoveredPlaybook?.id === playbook.id ? "is-active" : ""
              }`}
              onHover={onHover}
              onOpenPlaybook={onOpenPlaybook}
              style={{ "--card-x": `${x}px`, "--card-y": `${y}px` } as CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
}

function RingLayout({
  playbooks,
  hoveredPlaybook,
  onHover,
  onOpenPlaybook,
}: {
  playbooks: readonly PlaybookItem[];
  hoveredPlaybook: PlaybookItem | null;
  onHover: (playbook: PlaybookItem | null) => void;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
}) {
  const groups = ["H", "GN8"] as const;

  return (
    <div className={`layout-ring ${hoveredPlaybook ? "has-hover" : ""}`}>
      <div className="layout-ring__center">
        <CubeCore activeTitle={hoveredPlaybook?.title} />
      </div>
      {groups.map((group) => {
        const groupPlaybooks = playbooks.filter((playbook) => playbook.group === group);
        return (
          <section key={group} className={`layout-ring__group layout-ring__group--${group.toLowerCase()}`}>
            <div className="layout-ring__orbit" aria-hidden="true" />
            <div className="layout-ring__label">
              <span>{group}</span>
              {group === "H" ? "Human Story" : "Genesis 8"}
            </div>
            {groupPlaybooks.map((playbook, index) => (
              <PlaybookCard
                key={playbook.id}
                playbook={playbook}
                className={`layout-ring__card ${
                  hoveredPlaybook?.id === playbook.id ? "is-active" : ""
                }`}
                onHover={onHover}
                onOpenPlaybook={onOpenPlaybook}
                style={{ "--ring-angle": `${(360 / Math.max(groupPlaybooks.length, 1)) * index - 90}deg` } as CSSProperties}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function MatrixLayout({
  playbooks,
  hoveredPlaybook,
  onHover,
  onOpenPlaybook,
}: {
  playbooks: readonly PlaybookItem[];
  hoveredPlaybook: PlaybookItem | null;
  onHover: (playbook: PlaybookItem | null) => void;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
}) {
  return (
    <div className={`layout-matrix ${hoveredPlaybook ? "has-hover" : ""}`}>
      <div className="layout-matrix__heading">
        <span>Feature × User Story</span>
        <small>카드의 HW 값은 Hardware 축 위치입니다</small>
      </div>
      <div className="layout-matrix__table">
        <div className="layout-matrix__corner">USER STORY</div>
        {matrixColumnLabels.map((label) => (
          <div key={label} className="layout-matrix__axis-label">
            Feature {label}
          </div>
        ))}
        {matrixRowLabels.map((row, index) => (
          <div
            key={`row-${row}`}
            className="layout-matrix__row-label"
            style={{ "--matrix-row": index + 2 } as CSSProperties}
          >
            Story {row}
          </div>
        ))}
        {playbooks.map((playbook, index) => (
          <PlaybookCard
            key={playbook.id}
            playbook={playbook}
            className={`layout-matrix__card ${
              hoveredPlaybook?.id === playbook.id ? "is-active" : ""
            }`}
            onHover={onHover}
            onOpenPlaybook={onOpenPlaybook}
            style={{
              "--matrix-column": Number(playbook.cubeKey.split(",")[0]) + 2,
              "--matrix-row": Number(playbook.cubeKey.split(",")[2]) + 2,
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

export function PlaybookLayoutView({ mode, playbookGroup, onOpenPlaybook }: PlaybookLayoutViewProps) {
  const [hoveredPlaybook, setHoveredPlaybook] = useState<PlaybookItem | null>(null);
  const playbooks = getVisiblePlaybooks(playbookGroup);

  return (
    <main className={`playbook-layout playbook-layout--${mode}`} data-layout-mode={mode}>
      <div className="playbook-layout__backdrop" aria-hidden="true" />
      {mode === "constellation" ? (
        <ConstellationLayout
          playbooks={playbooks}
          hoveredPlaybook={hoveredPlaybook}
          onHover={setHoveredPlaybook}
          onOpenPlaybook={onOpenPlaybook}
        />
      ) : null}
      {mode === "ring" ? (
        <RingLayout
          playbooks={playbooks}
          hoveredPlaybook={hoveredPlaybook}
          onHover={setHoveredPlaybook}
          onOpenPlaybook={onOpenPlaybook}
        />
      ) : null}
      {mode === "matrix" ? (
        <MatrixLayout
          playbooks={playbooks}
          hoveredPlaybook={hoveredPlaybook}
          onHover={setHoveredPlaybook}
          onOpenPlaybook={onOpenPlaybook}
        />
      ) : null}
    </main>
  );
}
