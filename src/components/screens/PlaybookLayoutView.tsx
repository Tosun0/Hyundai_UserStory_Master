// @ts-nocheck
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PlaybookAccessGroup, PlaybookGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

const STORY_THUMBNAIL_SOURCES = PLAYBOOK_CATALOG
  .map((playbook) => playbook.thumbnailSrc ?? playbook.fallbackThumbnailSrc ?? "")
  .filter(Boolean);

useLoader.preload(THREE.TextureLoader, STORY_THUMBNAIL_SOURCES);

export type PlaybookLayoutMode = "solar" | "index" | "prism" | "timeline" | "orbit" | "helix" | "sphere";

type PlaybookLayoutViewProps = {
  mode: PlaybookLayoutMode;
  playbookGroup: PlaybookAccessGroup;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
};

function PrismChapterPanel({
  playbooks,
  selectedGroup,
  onSelectGroup,
}: {
  playbooks: readonly PlaybookItem[];
  selectedGroup: PlaybookGroup | null;
  onSelectGroup: (group: PlaybookGroup) => void;
}) {
  const chapters: readonly { group: PlaybookGroup; title: string; subtitle: string; color: string }[] = [
    { group: "H", title: "H SERIES", subtitle: "Everyday motion", color: "#6e9cff" },
    { group: "GN8", title: "GN8 SERIES", subtitle: "Future in motion", color: "#ff9d72" },
  ];

  return (
    <aside className="playbook-chapter-panel" aria-label="스토리 챕터 선택">
      <div className="playbook-chapter-panel__eyebrow">SELECT CHAPTER</div>
      <strong className="playbook-chapter-panel__title">NEXT MAP</strong>
      <div className="playbook-chapter-panel__cards">
        {chapters.map((chapter, index) => {
          const storyCount = playbooks.filter((playbook) => playbook.group === chapter.group).length;
          const isSelected = selectedGroup === chapter.group;
          return (
            <button
              key={chapter.group}
              type="button"
              className={`playbook-chapter-card ${isSelected ? "is-selected" : ""}`}
              style={{ "--chapter-color": chapter.color } as React.CSSProperties}
              onClick={() => onSelectGroup(chapter.group)}
              aria-pressed={isSelected}
            >
              <span className="playbook-chapter-card__number">0{index + 1}</span>
              <span className="playbook-chapter-card__copy">
                <strong>{chapter.title}</strong>
                <small>{chapter.subtitle}</small>
                <em>{storyCount} STORIES · {isSelected ? "MAP OPEN" : "PLAY CHAPTER"}</em>
              </span>
              <span className="playbook-chapter-card__arrow" aria-hidden="true">↗</span>
            </button>
          );
        })}
      </div>
      <span className="playbook-chapter-panel__hint">CHOOSE A CHAPTER TO UNLOCK THE MAP</span>
    </aside>
  );
}

type Vec3 = [number, number, number];

function getVisiblePlaybooks(group: PlaybookAccessGroup) {
  return group === "ALL"
    ? PLAYBOOK_CATALOG
    : PLAYBOOK_CATALOG.filter((playbook) => playbook.group === group);
}

function getSolarPosition(index: number): Vec3 {
  const ringIndex = Math.floor(index / 8);
  const ringSlot = index % 8;
  const radius = 5.45 + ringIndex * 1.65;
  const angle = (ringSlot / 8) * Math.PI * 2 + ringIndex * 0.38;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.62 - 0.4 - ringIndex * 0.12,
    ((ringSlot % 3) - 1) * 0.55 - ringIndex * 0.16,
  ];
}

const SOLAR_GROUP_COLORS: Record<PlaybookGroup, { primary: string; secondary: string }> = {
  H: { primary: "#74a7ff", secondary: "#d7a7ff" },
  GN8: { primary: "#ff9d72", secondary: "#ffd66e" },
};

function makeSolarCategoryTexture(group: PlaybookGroup, storyCount: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 260;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const colors = SOLAR_GROUP_COLORS[group];
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colors.primary);
  gradient.addColorStop(1, colors.secondary);
  context.fillStyle = "rgba(6, 9, 24, 0.82)";
  context.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 42);
  context.fill();
  context.strokeStyle = gradient;
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "700 78px Arial";
  context.fillText(group === "H" ? "HYUNDAI" : "GENESIS", 54, 112);
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "500 30px Arial";
  context.fillText(`${storyCount} STORY PLANETS`, 58, 172);
  context.fillStyle = colors.secondary;
  context.font = "700 24px Arial";
  context.fillText(group === "H" ? "H SERIES" : "GN8 SERIES", 58, 214);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeMapDistrictTexture(group: PlaybookGroup, storyCount: number, info = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = info ? 250 : 180;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const colors = SOLAR_GROUP_COLORS[group];
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `${colors.primary}ee`);
  gradient.addColorStop(1, `${colors.secondary}ee`);
  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 34);
  context.fill();
  context.strokeStyle = gradient;
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = "#273652";
  context.font = `900 ${info ? 62 : 48}px Arial`;
  context.fillText(`${group} DISTRICT`, 42, info ? 96 : 76);
  context.fillStyle = info ? "#5d6b84" : "rgba(39, 54, 82, 0.62)";
  context.font = `700 ${info ? 30 : 24}px Arial`;
  context.fillText(`${storyCount} STORIES  ·  ${info ? "STORY DISTRICT" : "STORY AREA"}`, 46, info ? 158 : 123);
  if (info) {
    context.fillStyle = colors.primary;
    context.font = "900 23px Arial";
    context.fillText("2D PLAYBOOK INFOGRAPHIC", 48, 207);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function StoryMapDistrictRegion({
  group,
  storyCount,
  position,
  selectedGroup,
  onSelect,
}: {
  group: PlaybookGroup;
  storyCount: number;
  position: Vec3;
  selectedGroup: PlaybookGroup | null;
  onSelect: (group: PlaybookGroup) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const texture = useMemo(() => makeMapDistrictTexture(group, storyCount), [group, storyCount]);
  const colors = SOLAR_GROUP_COLORS[group];
  const isSelected = selectedGroup === group;
  const isDimmed = selectedGroup !== null && !isSelected;

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    const targetScale = isDimmed ? 0.94 : isSelected ? 1.1 : hovered ? 1.045 : 1;
    ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
  });

  return (
    <group ref={ref} position={position}>
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI * 0.5, 0, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(group);
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
      >
        <planeGeometry args={[7.3, 8.9]} />
        <meshStandardMaterial color={colors.primary} transparent opacity={isDimmed ? 0.1 : isSelected ? 0.2 : hovered ? 0.2 : 0.12} roughness={1} />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[6.8, 8.4]} />
        <meshBasicMaterial color={colors.secondary} transparent opacity={isDimmed ? 0.06 : 0.08} depthWrite={false} toneMapped={false} />
      </mesh>
      {texture ? (
        <mesh
          position={[0, 0.11, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(group);
          }}
        >
          <planeGeometry args={[3.2, 0.64]} />
          <meshBasicMaterial map={texture} transparent opacity={isDimmed ? 0.72 : hovered ? 1 : 0.92} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function SolarCategoryPlanet({
  group,
  storyCount,
  stories,
  storyTextures,
  selectedGroup,
  onSelect,
}: {
  group: PlaybookGroup;
  storyCount: number;
  stories: readonly PlaybookItem[];
  storyTextures: readonly THREE.Texture[];
  selectedGroup: PlaybookGroup | null;
  onSelect: (group: PlaybookGroup) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const texture = useMemo(() => makeSolarCategoryTexture(group, storyCount), [group, storyCount]);
  const colors = SOLAR_GROUP_COLORS[group];
  const isSelected = selectedGroup === group;
  const isCompactStage = viewport.width < 9;

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    const isHidden = selectedGroup !== null && !isSelected;
    const targetPosition = isSelected
      ? [0, 0, -1.15]
      : group === "H"
        ? [isCompactStage ? -1.9 : -4.35, 0.15, -0.8]
        : [isCompactStage ? 1.9 : 4.35, -0.15, -0.8];
    const targetScale = isHidden ? 0.001 : isSelected ? 0.58 : isCompactStage ? 0.56 : 0.82;
    ref.current.position.lerp(new THREE.Vector3(...targetPosition), 1 - Math.pow(0.001, delta));
    ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
      ref.current.rotation.y += delta * (isSelected ? 0.22 : 0.12);
  });

  return (
    <group
      ref={ref}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(group);
      }}
    >
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1.75, 36, 24]} />
        <meshStandardMaterial
          color={colors.primary}
          emissive={colors.secondary}
          emissiveIntensity={1.05}
          roughness={0.24}
          metalness={0.3}
        />
      </mesh>
      <mesh rotation={[Math.PI * 0.5, 0.2, 0.18]} scale={1.22}>
        <torusGeometry args={[1.72, 0.045, 12, 96]} />
        <meshBasicMaterial color={colors.secondary} transparent opacity={0.82} toneMapped={false} />
      </mesh>
      <mesh rotation={[0.5, -0.7, 0.2]} scale={1.08}>
        <torusGeometry args={[1.85, 0.018, 8, 96]} />
        <meshBasicMaterial color={colors.primary} transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <SolarStorySatelliteCluster stories={stories} storyTextures={storyTextures} colors={colors} isSelected={isSelected} />
      {texture ? (
        <mesh position={[0, -2.05, 0.16]}>
          <planeGeometry args={[4.7, 1.2]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      ) : null}
      <pointLight color={colors.secondary} intensity={isSelected ? 18 : 12} distance={10} />
    </group>
  );
}

function SolarStorySatelliteCluster({
  stories,
  storyTextures,
  colors,
  isSelected,
}: {
  stories: readonly PlaybookItem[];
  storyTextures: readonly THREE.Texture[];
  colors: { primary: string; secondary: string };
  isSelected: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!ref.current) {
      return;
    }

    const targetScale = isSelected ? 0.001 : 1;
    ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
    ref.current.rotation.y += delta * 0.28;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.32) * 0.08;
  });

  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI * 0.5, 0.2, 0]}>
        <torusGeometry args={[2.55, 0.018, 8, 96]} />
        <meshBasicMaterial color={colors.secondary} transparent opacity={0.42} toneMapped={false} />
      </mesh>
      {stories.map((story, index) => {
        const angle = (index / Math.max(1, stories.length)) * Math.PI * 2;
        const radius = 2.45 + (index % 2) * 0.38;
        const position: Vec3 = [
          Math.cos(angle) * radius,
          Math.sin(angle * 1.35) * 0.62,
          Math.sin(angle) * radius * 0.54,
        ];
        return (
          <group key={`solar-satellite-${story.id}`} position={position}>
            <mesh castShadow>
              <sphereGeometry args={[0.28 + (index % 3) * 0.035, 20, 14]} />
              <meshStandardMaterial
                map={storyTextures[index % Math.max(1, storyTextures.length)]}
                color="#ffffff"
                emissive={colors.primary}
                emissiveIntensity={0.2}
                roughness={0.28}
                metalness={0.22}
              />
            </mesh>
            <mesh scale={1.22}>
              <sphereGeometry args={[0.28 + (index % 3) * 0.035, 12, 8]} />
              <meshBasicMaterial color={index % 2 ? colors.secondary : colors.primary} transparent opacity={0.38} wireframe toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function getIndexColumns(playbookCount: number) {
  return Math.min(8, Math.max(4, Math.ceil(Math.sqrt(Math.max(1, playbookCount) * 1.35))));
}

function getMapDistrictOffset(group: PlaybookGroup | null): Vec3 {
  if (group === "H") {
    return [-4.15, 0, 0.1];
  }
  if (group === "GN8") {
    return [4.15, 0, 0.1];
  }
  return [0, 0, 0];
}

function getIndexPosition(index: number, playbookCount: number, districtGroup: PlaybookGroup | null = null, overview = false): Vec3 {
  const [x, , z] = getIndexMapSlot(index, playbookCount);
  const [offsetX, , offsetZ] = getMapDistrictOffset(districtGroup);
  return [x + offsetX, overview ? 0.42 : 1.05 + (index % 4) * 0.06, z + offsetZ];
}

function getIndexMapSlot(index: number, playbookCount: number): Vec3 {
  const columns = getIndexColumns(playbookCount);
  const rows = Math.ceil(playbookCount / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [
    (column - (columns - 1) / 2) * 2.42,
    0,
    ((rows - 1) / 2 - row) * 1.75 - 0.2 + (column % 2 ? 0.12 : -0.12),
  ];
}

function getTimelineColumns(playbookCount: number) {
  return Math.min(6, Math.max(4, playbookCount));
}

function getTimelineRowY(row: number) {
  return row % 2 ? -0.95 : 0.95;
}

function getTimelinePosition(index: number, playbookCount: number): Vec3 {
  const columns = getTimelineColumns(playbookCount);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [
    (column - (columns - 1) / 2) * 2.28,
    getTimelineRowY(row),
    -row * 2.25,
  ];
}

function getOrbitPosition(index: number): Vec3 {
  const ring = Math.floor(index / 6);
  const slot = index % 6;
  const radius = 3.3 + ring * 1.85;
  const angle = (slot / 6) * Math.PI * 2 + ring * 0.45;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.52,
    Math.sin(angle) * 0.9 - ring * 0.45,
  ];
}

const HELIX_TURNS = 2.35;
const HELIX_TOTAL_ANGLE = Math.PI * 2 * HELIX_TURNS;
const HELIX_PITCH_PER_RADIAN = 0.9;
const HELIX_RAIL_RADII = [3.7, 4.22] as const;

function getHelixPoint(railIndex: number, angle: number): Vec3 {
  const radius = HELIX_RAIL_RADII[railIndex % HELIX_RAIL_RADII.length];
  // The camera is on +Z, so the near/front phase is +Z. At angle 0 every rail is exactly on
  // the camera's screen-center line: x = 0, y = 0, z = +radius.
  return [
    Math.sin(angle) * radius,
    angle * HELIX_PITCH_PER_RADIAN,
    Math.cos(angle) * radius,
  ];
}

function getHelixPosition(index: number, playbookCount: number): Vec3 {
  const railIndex = index % HELIX_RAIL_RADII.length;
  // Keep the original visual rhythm: cards are spaced by the global story
  // order, then alternated across the two rails instead of stacking at the
  // same height on each rail.
  const midpoint = (playbookCount - 1) / 2;
  const angle = (index - midpoint) * (HELIX_TOTAL_ANGLE / Math.max(1, playbookCount - 1));
  return getHelixPoint(railIndex, angle);
}

const SPHERE_SURFACE_RADIUS = 7.45;
const SPHERE_CARD_RADIUS = 7.18;
const SPHERE_RING_LAYOUT = [
  { latitude: -0.92, count: 6 },
  { latitude: -0.48, count: 8 },
  { latitude: 0, count: 8 },
  { latitude: 0.48, count: 8 },
  { latitude: 0.92, count: 6 },
] as const;
const SPHERE_LAYOUT_COUNT = 1 + SPHERE_RING_LAYOUT.reduce((total, ring) => total + ring.count, 0);

function getSphereSlotScale(index: number) {
  if (index === 0) return 1.18;
  return 0.92 + (index % 4) * 0.025;
}

function getSpherePosition(index: number, playbookCount: number): Vec3 {
  if (index === 0) {
    return [0, 0, -SPHERE_CARD_RADIUS];
  }

  let ringSlot = index - 1;
  for (const ring of SPHERE_RING_LAYOUT) {
    if (ringSlot < ring.count) {
      const latitude = ring.latitude;
      const longitude = ((ringSlot + 0.5) / ring.count) * Math.PI * 2 - Math.PI;
      const horizontalRadius = Math.cos(latitude) * SPHERE_CARD_RADIUS;
      return [
        Math.sin(longitude) * horizontalRadius,
        Math.sin(latitude) * SPHERE_CARD_RADIUS,
        -Math.cos(longitude) * horizontalRadius,
      ];
    }
    ringSlot -= ring.count;
  }

  // Keep future, larger catalogs on the same sphere instead of falling back
  // to a flat grid. The golden-angle fill is only used after the designed rings.
  const extraIndex = index - SPHERE_LAYOUT_COUNT;
  const extraCount = Math.max(1, playbookCount - SPHERE_LAYOUT_COUNT);
  const phi = Math.acos(1 - 2 * ((extraIndex + 0.5) / extraCount));
  const theta = extraIndex * Math.PI * (3 - Math.sqrt(5));
  const horizontalRadius = Math.sin(phi) * SPHERE_CARD_RADIUS;
  return [
    Math.cos(theta) * horizontalRadius,
    Math.cos(phi) * SPHERE_CARD_RADIUS,
    -Math.sin(theta) * horizontalRadius,
  ];
}

function getCameraDistance(mode: PlaybookLayoutMode, playbooks: readonly PlaybookItem[]) {
  const playbookCount = playbooks.length;

  if (mode === "solar") {
    return 17.5 + Math.max(0, Math.ceil(playbookCount / 8) - 1) * 1.65;
  }

  if (mode === "prism") {
    return 17.5 + Math.min(14, Math.max(0, Math.ceil(playbookCount / 4) - 3) * 0.6);
  }

  if (mode === "index") {
    const rows = Math.ceil(playbooks.length / getIndexColumns(playbooks.length));
    return 20.5 + Math.min(14, Math.max(0, rows - 3) * 1.35);
  }

  if (mode === "timeline") {
    return 18.5 + Math.min(10, Math.max(0, Math.ceil(playbooks.length / 5) - 2) * 1.2);
  }

  if (mode === "helix") {
    return 17.5;
  }

  if (mode === "sphere") {
    return 1;
  }

  return 18.5 + Math.min(6, Math.max(0, Math.ceil(playbooks.length / 6) - 2) * 0.65);
}

const CARD_DRAG_THRESHOLD = 8;

function cubePosition(
  playbook: PlaybookItem,
  index: number,
  mode: PlaybookLayoutMode,
  visiblePlaybooks: readonly PlaybookItem[],
  mapDistrictGroup: PlaybookGroup | null = null,
  mapOverview = false,
): Vec3 {
  const [, groupAxis] = playbook.cubeKey.split(",").map(Number);

  if (mode === "solar") {
    return getSolarPosition(index);
  }

  if (mode === "index") {
    if (mapDistrictGroup) {
      const districtPlaybooks = visiblePlaybooks.filter((item) => item.group === mapDistrictGroup);
      const districtIndex = Math.max(0, districtPlaybooks.indexOf(playbook));
      return getIndexPosition(districtIndex, districtPlaybooks.length, mapDistrictGroup, false);
    }
    if (mapOverview) {
      const districtPlaybooks = visiblePlaybooks.filter((item) => item.group === playbook.group);
      const districtIndex = Math.max(0, districtPlaybooks.indexOf(playbook));
      return getIndexPosition(districtIndex, districtPlaybooks.length, playbook.group, true);
    }
    return getIndexPosition(index, visiblePlaybooks.length, mapDistrictGroup, false);
  }

  if (mode === "timeline") {
    return getTimelinePosition(index, visiblePlaybooks.length);
  }

  if (mode === "orbit") {
    return getOrbitPosition(index);
  }

  if (mode === "helix") {
    return getHelixPosition(index, visiblePlaybooks.length);
  }

  if (mode === "sphere") {
    return getSpherePosition(index, Math.max(SPHERE_LAYOUT_COUNT, visiblePlaybooks.length));
  }

  const columns = Math.min(5, Math.max(4, visiblePlaybooks.length));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [
    (column - (columns - 1) / 2) * 2.7 + (row % 2 ? 0.34 : -0.34),
    ((Math.ceil(visiblePlaybooks.length / columns) - 1) / 2 - row) * 1.7,
    -0.5 - row * 0.7 + (groupAxis - 3.5) * 0.16,
  ];
}

function makeInfoTexture(playbook: PlaybookItem) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 220;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 18, 28, 0.88)";
  context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 22);
  context.fill();
  context.fillStyle = "#8ab4ff";
  context.font = "700 25px Arial";
  context.fillText(`${playbook.id}  ·  ${playbook.cubeKey}`, 28, 46);
  context.fillStyle = "#ffffff";
  context.font = "800 31px Arial";
  context.fillText(playbook.title.slice(0, 27), 28, 94);
  context.fillStyle = "rgba(255,255,255,0.68)";
  context.font = "500 21px Arial";
  context.fillText(playbook.tags.join("  /  "), 28, 136);
  context.fillStyle = "rgba(255,255,255,0.52)";
  context.font = "500 18px Arial";
  context.fillText("CLICK TO OPEN USER STORY", 28, 181);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeStoryLabelTexture(playbook: PlaybookItem, index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 126;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18);
  context.fill();
  context.fillStyle = playbook.group === "H" ? "#4f6fc9" : "#c75d7d";
  context.font = "800 21px Arial";
  context.fillText(`${String(index + 1).padStart(2, "0")}  ·  ${playbook.id}`, 24, 36);
  context.fillStyle = "#24324f";
  context.font = "800 27px Arial";
  context.fillText(playbook.title.slice(0, 30), 24, 79);
  context.fillStyle = "rgba(36,50,79,0.62)";
  context.font = "500 17px Arial";
  context.fillText(playbook.tags.slice(0, 3).join("  /  "), 24, 106);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeWatercolorTexture(mode: PlaybookLayoutMode) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const isIndex = mode === "index";
  context.fillStyle = isIndex ? "#f7faff" : "#fff9f2";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (isIndex) {
    const colors = ["#ffb7d1", "#9ddcff", "#c9b7ff", "#b9efd0", "#ffd28e"];
    context.globalCompositeOperation = "multiply";
    for (let tile = 0; tile < 18; tile += 1) {
      const color = colors[tile % colors.length];
      const x = 34 + ((tile * 181) % 930);
      const y = 64 + ((tile * 263) % 900);
      const width = 170 + (tile % 3) * 48;
      const height = 82 + (tile % 4) * 22;
      context.save();
      context.translate(x, y);
      context.rotate((tile % 5 - 2) * 0.045);
      context.fillStyle = color;
      context.globalAlpha = 0.23;
      context.roundRect(-width / 2, -height / 2, width, height, 28);
      context.fill();
      context.strokeStyle = "#ffffff";
      context.globalAlpha = 0.46;
      context.lineWidth = 8;
      context.stroke();
      context.restore();
    }

    context.globalCompositeOperation = "source-over";
    [["#f4a6c7", 170, 740], ["#83cfff", 820, 170], ["#c1a8ff", 820, 820]].forEach(([color, x, y], index) => {
      const gradient = context.createRadialGradient(x, y, 10, x, y, 260 + index * 40);
      gradient.addColorStop(0, `${color}66`);
      gradient.addColorStop(1, `${color}00`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    });
  } else {
    const colors = ["#ff9fc8", "#a9ccff", "#bca8ff", "#9de5cf", "#ffc995"];
    context.globalCompositeOperation = "multiply";
    for (let band = 0; band < 8; band += 1) {
      const color = colors[band % colors.length];
      const y = 92 + band * 132;
      context.save();
      context.translate(0, y);
      context.rotate((band % 2 ? -1 : 1) * 0.025);
      context.fillStyle = color;
      context.globalAlpha = 0.2;
      context.beginPath();
      context.moveTo(-30, -38 + (band % 3) * 8);
      context.quadraticCurveTo(230, -86, 520, -18);
      context.quadraticCurveTo(820, 48, 1060, -22);
      context.lineTo(1060, 48);
      context.quadraticCurveTo(790, 106, 500, 40);
      context.quadraticCurveTo(220, -20, -30, 38);
      context.closePath();
      context.fill();
      context.restore();
    }

    context.globalCompositeOperation = "source-over";
    context.lineCap = "round";
    colors.forEach((color, index) => {
      context.strokeStyle = color;
      context.globalAlpha = 0.22;
      context.lineWidth = 16 + (index % 3) * 8;
      context.beginPath();
      context.moveTo(-60, 150 + index * 190);
      context.bezierCurveTo(260, 40 + index * 190, 700, 280 + index * 150, 1080, 110 + index * 160);
      context.stroke();
    });
  }

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.1;
  for (let grain = 0; grain < 4200; grain += 1) {
    const x = (grain * 73) % canvas.width;
    const y = (grain * 151) % canvas.height;
    const size = grain % 5 === 0 ? 2 : 1;
    context.fillStyle = grain % 2 ? "#ffffff" : "#8f83aa";
    context.fillRect(x, y, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function WatercolorBackdrop({ mode }: { mode: PlaybookLayoutMode }) {
  const { scene } = useThree();
  const texture = useMemo(
    () => (mode === "timeline" ? makeWatercolorTexture(mode) : null),
    [mode],
  );

  useEffect(() => {
    if (!texture) {
      return undefined;
    }

    scene.background = texture;
    return () => {
      if (scene.background === texture) {
        scene.background = null;
      }
      texture.dispose();
    };
  }, [scene, texture]);

  return null;
}

function InfoPanel({ playbook, visible }: { playbook: PlaybookItem; visible: boolean }) {
  const texture = useMemo(() => (visible ? makeInfoTexture(playbook) : null), [playbook, visible]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture || !visible) {
    return null;
  }

  return (
    <mesh position={[0, -1.28, 0.28]} rotation={[-0.04, 0, 0]}>
      <planeGeometry args={[2.25, 0.65]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function makeCurvedCardGeometry(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 16, 5);
  const position = geometry.attributes.position;
  const halfWidth = width * 0.5;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const normalizedX = x / halfWidth;
    position.setZ(index, 0.18 * normalizedX * normalizedX);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makeRoundedMarkerGeometry(width: number, height: number, depth: number, radius: number) {
  const shape = new THREE.Shape();
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const r = Math.min(radius, halfWidth, halfHeight);
  shape.moveTo(-halfWidth + r, -halfHeight);
  shape.lineTo(halfWidth - r, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r);
  shape.lineTo(halfWidth, halfHeight - r);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
  shape.lineTo(-halfWidth + r, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r);
  shape.lineTo(-halfWidth, -halfHeight + r);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    depth,
    steps: 1,
  });
  geometry.center();
  return geometry;
}

function PlaybookObject({
  playbook,
  index,
  mode,
  visiblePlaybooks,
  mapDistrictGroup,
  mapOverview,
  shadowsEnabled,
  texture,
  onHover,
  hovered,
  focused,
  hasQuery,
  selected,
  hasSelection,
  focusedView,
  hasFocusedView,
  onFocusPlaybook,
}: {
  playbook: PlaybookItem;
  index: number;
  mode: PlaybookLayoutMode;
  visiblePlaybooks: readonly PlaybookItem[];
  mapDistrictGroup?: PlaybookGroup | null;
  mapOverview?: boolean;
  shadowsEnabled: boolean;
  texture: THREE.Texture;
  onHover: (index: number | null) => void;
  hovered: boolean;
  focused: boolean;
  hasQuery: boolean;
  selected: boolean;
  hasSelection: boolean;
  focusedView: boolean;
  hasFocusedView: boolean;
  onFocusPlaybook: (playbook: PlaybookItem, index: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const basePosition = useMemo(
    () => cubePosition(playbook, index, mode, visiblePlaybooks, mapDistrictGroup, mapOverview),
    [index, mapDistrictGroup, mapOverview, mode, playbook, visiblePlaybooks],
  );
  const sideColor = playbook.group === "H" ? "#6d89bd" : "#b88763";
  const prismPalette = ["#ff6b9d", "#65d6ff", "#ffd166", "#a78bfa", "#7ee7bd"];
  const lightPalette = mode === "index"
    ? ["#8cc8ff", "#ffb6d2", "#b8efcf", "#ffd28d", "#c9b7ff"]
    : ["#b8a8ff", "#ffc47f", "#91ddff", "#ff9fcf", "#b9efcf"];
  const isIndex = mode === "index";
  const isPrism = mode === "prism";
  const isHelix = mode === "helix";
  const isSphere = mode === "sphere";
  const layoutScale = isIndex ? (mapOverview ? (focusedView ? 0.86 : 0.4) : 0.86) : isPrism ? 0.88 : isSphere ? 0.58 : 0.9;
  const cardGeometry = useMemo(
    () => isSphere ? makeCurvedCardGeometry(2, 1.12) : makeCurvedCardGeometry(2.5, 1.5),
    [isSphere],
  );
  const mapMarkerGeometry = useMemo(
    () => (isIndex ? makeRoundedMarkerGeometry(2.2, 1.34, 0.22, 0.18) : null),
    [isIndex],
  );
  const baseRotation = useMemo<Vec3>(
    () => isIndex
      ? [0, -0.05 + (index % 3) * 0.05, 0]
      : mode === "timeline"
        ? [0.02, index % 2 ? -0.08 : 0.08, index % 2 ? -0.04 : 0.04]
      : isSphere
        ? [0, -basePosition[0] * 0.015, basePosition[1] * 0.012]
        : isHelix
          ? [0.02, -basePosition[0] * 0.025, basePosition[2] * 0.015]
          : [0.08 + (index % 3) * 0.035, -0.18 + (index % 4) * 0.08, 0],
    [basePosition, index, isHelix, isIndex, isSphere, mode],
  );

  useEffect(() => () => {
    cardGeometry.dispose();
    mapMarkerGeometry?.dispose();
  }, [cardGeometry, mapMarkerGeometry]);

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    if (isSphere) {
      // The camera is inside the sphere, so every card faces the center rather
      // than the outside surface. The focused card turns toward the camera.
      const sphereNormal = new THREE.Vector3(-basePosition[0], -basePosition[1], -basePosition[2]).normalize();
      const sphereUp = new THREE.Vector3(0, 1, 0);
      if (hasFocusedView && focusedView) {
        const cameraWorldPosition = camera.getWorldPosition(new THREE.Vector3());
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
        const parent = group.parent;
        const cameraPosition = parent?.worldToLocal(cameraWorldPosition.clone()) ?? cameraWorldPosition;
        const upPoint = parent?.worldToLocal(cameraWorldPosition.clone().add(cameraUp)) ?? cameraWorldPosition.clone().add(cameraUp);
        sphereNormal.copy(cameraPosition.sub(group.position).normalize());
        sphereUp.copy(upPoint.sub(cameraPosition).projectOnPlane(sphereNormal).normalize());
      } else {
        // setFromUnitVectors leaves roll underconstrained. Projecting the
        // sphere's up axis onto the card tangent keeps thumbnails upright while
        // the sphere rotates around the viewer.
        if (Math.abs(sphereUp.dot(sphereNormal)) > 0.96) {
          sphereUp.set(1, 0, 0);
        }
        sphereUp.addScaledVector(sphereNormal, -sphereUp.dot(sphereNormal)).normalize();
      }
      if (sphereUp.lengthSq() < 0.01) {
        sphereUp.set(1, 0, 0).addScaledVector(sphereNormal, -sphereNormal.x).normalize();
      }
      const sphereRight = new THREE.Vector3().crossVectors(sphereUp, sphereNormal).normalize();
      group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sphereRight, sphereUp, sphereNormal));
    } else if (isHelix) {
      const parent = group.parent;
      if (parent) {
        // Keep the thumbnail's +Z normal aligned with the camera's +Z axis
        // in the card parent's local space. This remains stable while the
        // entire helix rotates, so cards never expose their back surface.
        const parentWorldQuaternion = parent.getWorldQuaternion(new THREE.Quaternion());
        const cameraWorldQuaternion = camera.getWorldQuaternion(new THREE.Quaternion());
        group.quaternion.copy(parentWorldQuaternion.invert().multiply(cameraWorldQuaternion));
      }
    } else if (isIndex && !mapOverview) {
      const parent = group.parent;
      const cameraWorldPosition = camera.getWorldPosition(new THREE.Vector3());
      const cameraPosition = parent?.worldToLocal(cameraWorldPosition.clone()) ?? cameraWorldPosition;
      const normal = cameraPosition.sub(group.position).normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(normal.dot(worldUp)) > 0.96) {
        worldUp.set(0, 0, 1);
      }
      const right = new THREE.Vector3().crossVectors(worldUp, normal).normalize();
      const up = new THREE.Vector3().crossVectors(normal, right).normalize();
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, up, normal),
      );
      group.quaternion.slerp(targetQuaternion, 1 - Math.pow(0.001, delta));
    }

    const interactionPosition = new THREE.Vector3(basePosition[0], basePosition[1], basePosition[2]);
    const modeFocus = mode !== "timeline" && selected;

    if (hasFocusedView) {
      if (focusedView) {
        if (mode === "sphere") {
          const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
          const focusPosition = cameraPosition.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2.7));
          group.parent?.worldToLocal(focusPosition);
          interactionPosition.copy(focusPosition);
        } else {
          interactionPosition.set(0, 0, 2.35);
        }
      }
    }

    if (modeFocus && !hasFocusedView) {
      if (mode === "orbit" || mode === "prism") {
        // These modes are focus tools: the selected story is pulled into the
        // viewing lane instead of only receiving a small hover offset.
        interactionPosition.set(0, 0, mode === "orbit" ? 2.65 : 2.9);
      } else if (mode === "solar") {
        interactionPosition.z += 0.42;
      }

      // Keep the hover cue in a shallow, shared depth band so it never jumps
      // across neighbouring cards or drops out from under the pointer.
      if (mode === "orbit" || mode === "prism") {
        interactionPosition.y += mode === "prism" ? 0.12 : 0;
      } else if (mode === "sphere") {
        interactionPosition.add(new THREE.Vector3(-basePosition[0], -basePosition[1], -basePosition[2]).normalize().multiplyScalar(0.18));
      } else {
        interactionPosition.y += 0.1;
        interactionPosition.z += mode === "helix" ? 0.34 : 0.28;
      }
    }

    const targetScale = layoutScale
      * (isSphere ? getSphereSlotScale(index) : 1)
      * (hovered ? 1.08 : 1)
      * (isIndex && hasQuery && !focused ? 0.82 : 1)
      * (hasSelection && !selected && mode !== "timeline" ? 0.88 : 1)
      * (hasFocusedView ? (focusedView ? 1.48 : 0.001) : 1);
    group.position.lerp(interactionPosition, 1 - Math.pow(0.001, delta));
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
  });

  const opacity = isIndex && hasQuery && !focused
    ? 0.16
    : hasSelection && !selected && mode !== "timeline"
      ? 0.62
      : 1;
  const interactiveDim = hasSelection && !selected && mode !== "timeline";
  const lightStage = isIndex || mode === "timeline" || isSphere;
  const viewOpacity = hasFocusedView && !focusedView ? 0 : opacity;
  const transparent = lightStage || isPrism || isHelix || isSphere || (isIndex && hasQuery) || interactiveDim || hasFocusedView;
  const spherePalette = ["#e8edf4", "#fff1e7", "#e6f2fb", "#f8e7ed", "#ece9fb"];
  const surfaceColor = isSphere
    ? spherePalette[index % spherePalette.length]
    : isIndex
    ? lightPalette[index % lightPalette.length]
    : mode === "timeline"
      ? lightPalette[index % lightPalette.length]
      : isPrism
        ? prismPalette[index % prismPalette.length]
      : sideColor;
  const surfaceOpacity = isSphere ? 0.92 * viewOpacity : isIndex ? 0.7 * viewOpacity : mode === "timeline" ? 0.86 * viewOpacity : isPrism ? 0.78 * viewOpacity : viewOpacity;
  const timelineLabelTexture = useMemo(
    () => (mode === "timeline" ? makeStoryLabelTexture(playbook, index) : null),
    [index, mode, playbook],
  );

  useEffect(() => () => timelineLabelTexture?.dispose(), [timelineLabelTexture]);

  const material = (map?: THREE.Texture) => ({
    color: surfaceColor,
    map,
    transparent,
    opacity: surfaceOpacity,
    emissive: playbook.group === "H" ? "#294f9a" : "#7d3f20",
    emissiveIntensity: selected ? 0.72 : lightStage ? 0.2 : isPrism || mode === "solar" || mode === "orbit" ? 0.2 : 0.06,
    roughness: lightStage || isPrism ? 0.16 : 0.42,
    metalness: lightStage || isPrism ? 0.22 : 0.35,
  });

  const renderShape = () => {
    if (mode === "solar") {
      return (
        <>
          <mesh castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <icosahedronGeometry args={[0.92, 1]} />
            <meshStandardMaterial {...material(texture)} roughness={0.28} metalness={0.28} />
          </mesh>
          <mesh scale={1.1}>
            <icosahedronGeometry args={[0.92, 1]} />
            <meshBasicMaterial color={sideColor} transparent opacity={0.2 * opacity} wireframe />
          </mesh>
        </>
      );
    }

    if (isIndex && mapOverview) {
      return (
        <>
          <mesh
            position={[0, 0.028, 0]}
            rotation={[-Math.PI * 0.5, 0, 0]}
            onClick={(event) => {
              event.stopPropagation();
              if (event.delta > CARD_DRAG_THRESHOLD) {
                return;
              }
              onFocusPlaybook(playbook, index);
            }}
          >
            <circleGeometry args={[0.62, 28]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
            <circleGeometry args={[0.34, 28]} />
            <meshBasicMaterial map={texture} color="#ffffff" transparent opacity={viewOpacity} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[Math.PI * 0.5, 0, 0]} scale={1.18}>
            <torusGeometry args={[0.34, 0.035, 8, 28]} />
            <meshBasicMaterial color={playbook.group === "H" ? "#5279d8" : "#d77792"} transparent opacity={0.9 * viewOpacity} toneMapped={false} />
          </mesh>
        </>
      );
    }

    if (isIndex) {
      return (
        <>
          <mesh geometry={mapMarkerGeometry} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <meshStandardMaterial {...material()} color={surfaceColor} roughness={0.2} metalness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.22]} renderOrder={30}>
            <planeGeometry args={[1.82, 0.86]} />
            <meshBasicMaterial map={texture} transparent opacity={viewOpacity} toneMapped={false} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      );
    }

    if (mode === "timeline") {
      return (
        <>
          <mesh position={[0, 0.12, 0]} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <boxGeometry args={[1.84, 1.18, 0.36]} />
            <meshStandardMaterial {...material()} roughness={0.16} metalness={0.28} />
          </mesh>
          <mesh position={[0, 0.12, 0.19]}>
            <planeGeometry args={[1.58, 0.82]} />
            <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.66, 0.2]}>
            <planeGeometry args={[1.84, 0.3]} />
            <meshBasicMaterial map={timelineLabelTexture} transparent opacity={opacity} toneMapped={false} />
          </mesh>
        </>
      );
    }

    if (mode === "orbit") {
      return (
        <>
          <mesh castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <sphereGeometry args={[0.9, 24, 18]} />
            <meshStandardMaterial {...material(texture)} roughness={0.22} metalness={0.38} />
          </mesh>
          <mesh scale={1.12}>
            <sphereGeometry args={[0.9, 16, 12]} />
            <meshBasicMaterial color={sideColor} transparent opacity={0.23 * opacity} wireframe />
          </mesh>
        </>
      );
    }

    if (isHelix || isSphere) {
      return (
        <>
          {isSphere ? (
            <mesh geometry={cardGeometry} position={[0.08, -0.09, -0.12]} renderOrder={4}>
              <meshBasicMaterial color="#1f2937" transparent opacity={0.16 * viewOpacity} depthWrite={false} side={THREE.FrontSide} />
            </mesh>
          ) : null}
          <mesh geometry={cardGeometry} position={[0, 0, -0.055]} renderOrder={5} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <meshStandardMaterial
              color={isSphere ? "#f8fafc" : surfaceColor}
              transparent
              opacity={(isSphere ? 0.98 : 0.94) * viewOpacity}
              roughness={isSphere ? 0.34 : 0.2}
              metalness={isSphere ? 0.05 : 0.24}
              depthWrite
              side={isSphere ? THREE.FrontSide : THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={cardGeometry} position={[0, 0, 0.015]} scale={isSphere ? [0.92, 0.84, 1] : 1} renderOrder={20}>
            <meshBasicMaterial map={texture} transparent opacity={viewOpacity} toneMapped={false} depthWrite={isSphere} side={isSphere ? THREE.FrontSide : THREE.DoubleSide} />
          </mesh>
        </>
      );
    }

    if (isPrism) {
      return (
        <>
          <mesh castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <boxGeometry args={[2.2, 1.28, 0.24]} />
            <meshStandardMaterial {...material()} roughness={0.14} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.14]}>
            <planeGeometry args={[1.92, 0.98]} />
            <meshBasicMaterial map={texture} transparent opacity={opacity} toneMapped={false} />
          </mesh>
          <mesh scale={1.08}>
            <boxGeometry args={[2.2, 1.28, 0.24]} />
            <meshBasicMaterial color={surfaceColor} transparent opacity={0.42 * opacity} wireframe toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.71, 0.16]}>
            <boxGeometry args={[2.2, 0.055, 0.055]} />
            <meshBasicMaterial color={surfaceColor} transparent opacity={0.9 * opacity} toneMapped={false} />
          </mesh>
        </>
      );
    }

    return (
      <>
        <mesh castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
          <boxGeometry args={[2.12, 1.3, 0.72]} />
          <meshStandardMaterial {...material()} roughness={0.36} metalness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.365]}>
          <planeGeometry args={[1.86, 0.96]} />
          <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} toneMapped={false} />
        </mesh>
        <mesh position={[-0.98, 0, 0.39]}>
          <boxGeometry args={[0.08, 1.08, 0.08]} />
          <meshBasicMaterial color={playbook.group === "H" ? "#5279d8" : "#bd7e54"} transparent opacity={opacity} />
        </mesh>
      </>
    );
  };

  return (
    <group
      ref={groupRef}
      position={basePosition}
      rotation={baseRotation}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta > CARD_DRAG_THRESHOLD) {
          return;
        }
        onFocusPlaybook(playbook, index);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        onHover(index);
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        onHover(null);
      }}
    >
      {renderShape()}
      {isIndex && !mapOverview ? (
        <group position={[0, -0.53, 0.1]}>
          <mesh position={[0, -0.31, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.62, 12]} />
            <meshStandardMaterial color={playbook.group === "H" ? "#5279d8" : "#d77792"} emissive={playbook.group === "H" ? "#7fd8ff" : "#ff9fcf"} emissiveIntensity={0.5} roughness={0.28} metalness={0.24} />
          </mesh>
          <mesh position={[0, -0.66, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.06, 24]} />
            <meshStandardMaterial color={playbook.group === "H" ? "#5279d8" : "#d77792"} emissive={playbook.group === "H" ? "#7fd8ff" : "#ff9fcf"} emissiveIntensity={0.42} roughness={0.2} metalness={0.18} />
          </mesh>
        </group>
      ) : null}
      <InfoPanel playbook={playbook} visible={hovered || focusedView} />
    </group>
  );
}

function SolarSystemStage({
  playbooks,
  textures,
  selectedGroup,
  hoveredIndex,
  focusedIds,
  focusedViewIndex,
  onSelectGroup,
  onHover,
  onFocusPlaybook,
}: {
  playbooks: readonly PlaybookItem[];
  textures: readonly THREE.Texture[];
  selectedGroup: PlaybookGroup | null;
  hoveredIndex: number | null;
  focusedIds: ReadonlySet<string>;
  focusedViewIndex: number | null;
  onSelectGroup: (group: PlaybookGroup) => void;
  onHover: (index: number | null) => void;
  onFocusPlaybook: (playbook: PlaybookItem, index: number) => void;
}) {
  const { viewport } = useThree();
  const selectedSystemRef = useRef<THREE.Group>(null);
  const storyPlaybooks = selectedGroup
    ? playbooks.filter((playbook) => playbook.group === selectedGroup)
    : [];
  const shadowsEnabled = storyPlaybooks.length <= 32;
  const isCompactStage = viewport.width < 9;

  useFrame((_, delta) => {
    if (!selectedSystemRef.current) {
      return;
    }

    if (!selectedSystemRef.current.userData.initialized) {
      selectedSystemRef.current.scale.setScalar(0.001);
      selectedSystemRef.current.userData.initialized = true;
    }
    const targetScale = isCompactStage ? 0.46 : 0.82;
    selectedSystemRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      1 - Math.pow(0.001, delta),
    );
    selectedSystemRef.current.rotation.y += delta * 0.08;
  });

  return (
    <group>
      <mesh
        position={[0, 0, -8]}
        onClick={(event) => {
          event.stopPropagation();
          if (selectedGroup) {
            onSelectGroup(selectedGroup);
          }
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <SolarCategoryPlanet
        group="H"
        storyCount={playbooks.filter((playbook) => playbook.group === "H").length}
        stories={playbooks.filter((playbook) => playbook.group === "H")}
        storyTextures={playbooks.filter((playbook) => playbook.group === "H").map((playbook) => textures[playbooks.indexOf(playbook)])}
        selectedGroup={selectedGroup}
        onSelect={onSelectGroup}
      />
      <SolarCategoryPlanet
        group="GN8"
        storyCount={playbooks.filter((playbook) => playbook.group === "GN8").length}
        stories={playbooks.filter((playbook) => playbook.group === "GN8")}
        storyTextures={playbooks.filter((playbook) => playbook.group === "GN8").map((playbook) => textures[playbooks.indexOf(playbook)])}
        selectedGroup={selectedGroup}
        onSelect={onSelectGroup}
      />
      {selectedGroup ? (
        <group ref={selectedSystemRef}>
          {[3.25, 4.85, 6.35].map((radius, index) => (
            <mesh key={radius} rotation={[Math.PI * 0.5, index * 0.22, index * 0.12]} position={[0, 0, -0.95]}>
              <torusGeometry args={[radius, index === 1 ? 0.045 : 0.025, 8, 128]} />
              <meshBasicMaterial
                color={SOLAR_GROUP_COLORS[selectedGroup][index % 2 ? "secondary" : "primary"]}
                transparent
                opacity={0.34 - index * 0.05}
                toneMapped={false}
              />
            </mesh>
          ))}
          {storyPlaybooks.map((playbook, index) => (
            <PlaybookObject
              key={`${playbook.id}-${index}`}
              playbook={playbook}
              index={index}
              mode="solar"
              visiblePlaybooks={storyPlaybooks}
              shadowsEnabled={shadowsEnabled}
              hovered={hoveredIndex === index}
              focused={focusedIds.has(playbook.id)}
              hasQuery={false}
              selected={hoveredIndex === index}
              hasSelection={hoveredIndex !== null}
              focusedView={focusedViewIndex === index}
              hasFocusedView={focusedViewIndex !== null}
              texture={storyTextures[index % storyTextures.length]}
              onHover={onHover}
              onFocusPlaybook={onFocusPlaybook}
            />
          ))}
          <mesh position={[0, 0, -1.25]}>
            <sphereGeometry args={[0.72, 24, 16]} />
            <meshStandardMaterial
              color={SOLAR_GROUP_COLORS[selectedGroup].primary}
              emissive={SOLAR_GROUP_COLORS[selectedGroup].secondary}
              emissiveIntensity={1.4}
              transparent
              opacity={0.82}
              roughness={0.2}
              metalness={0.42}
            />
          </mesh>
          <pointLight color={SOLAR_GROUP_COLORS[selectedGroup].secondary} intensity={18} distance={14} />
        </group>
      ) : null}
    </group>
  );
}

function CoreCube({ mode }: { mode: PlaybookLayoutMode }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (mode === "solar" && ref.current) {
      ref.current.rotation.y += delta * 0.18;
      ref.current.rotation.x += delta * 0.05;
    }
  });

  if (mode !== "solar") {
    return null;
  }

  return (
    <group position={[0, 0, -0.7]}>
      <mesh ref={ref} rotation={[0.32, -0.42, 0]}>
        <icosahedronGeometry args={[1.28, 2]} />
        <meshStandardMaterial color="#ff6b9d" transparent opacity={0.22} roughness={0.16} metalness={0.55} wireframe />
      </mesh>
      <mesh rotation={[-0.1, 0.5, 0.2]}>
        <boxGeometry args={[2.8, 2.8, 0.035]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.3} wireframe />
      </mesh>
      <pointLight color="#ff6b9d" intensity={20} distance={11} />
    </group>
  );
}

function OrbitController({ mode, sphereGroupRef }: { mode: PlaybookLayoutMode; sphereGroupRef: React.RefObject<THREE.Group> }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const sphereRotationTarget = useRef(new THREE.Vector2());
  const sphereRotation = useRef(new THREE.Vector2());
  const sphereFovTarget = useRef(68);

  useEffect(() => {
    if (mode === "sphere") {
      let pointerStart: { x: number; y: number } | null = null;
      const handlePointerDown = (event: PointerEvent) => {
        pointerStart = { x: event.clientX, y: event.clientY };
      };
      const handlePointerMove = (event: PointerEvent) => {
        if (!pointerStart) {
          return;
        }
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        sphereRotationTarget.current.y -= deltaX * 0.0045;
        sphereRotationTarget.current.x = THREE.MathUtils.clamp(
          sphereRotationTarget.current.x - deltaY * 0.0045,
          -1.15,
          1.15,
        );
        pointerStart = { x: event.clientX, y: event.clientY };
      };
      const handlePointerUp = () => {
        pointerStart = null;
      };
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        sphereFovTarget.current = THREE.MathUtils.clamp(
          sphereFovTarget.current + event.deltaY * 0.025,
          50,
          84,
        );
      };

      gl.domElement.addEventListener("pointerdown", handlePointerDown);
      gl.domElement.addEventListener("pointermove", handlePointerMove);
      gl.domElement.addEventListener("pointerup", handlePointerUp);
      gl.domElement.addEventListener("pointercancel", handlePointerUp);
      gl.domElement.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        gl.domElement.removeEventListener("pointerdown", handlePointerDown);
        gl.domElement.removeEventListener("pointermove", handlePointerMove);
        gl.domElement.removeEventListener("pointerup", handlePointerUp);
        gl.domElement.removeEventListener("pointercancel", handlePointerUp);
        gl.domElement.removeEventListener("wheel", handleWheel);
      };
    }

    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = mode === "index";
    controls.screenSpacePanning = mode === "index";
    controls.enableZoom = mode !== "helix";
    controls.zoomSpeed = 0.8;
    controls.minDistance = mode === "index" ? 9 : 10;
    controls.maxDistance = mode === "index" ? 34 : 28;
    controls.rotateSpeed = 0.55;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.enabled = mode !== "helix";
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, mode]);

  useFrame((_, delta) => {
    if (mode === "sphere") {
      const sphereGroup = sphereGroupRef.current;
      if (sphereGroup) {
        sphereRotation.current.x = THREE.MathUtils.damp(sphereRotation.current.x, sphereRotationTarget.current.x, 7, delta);
        sphereRotation.current.y = THREE.MathUtils.damp(sphereRotation.current.y, sphereRotationTarget.current.y, 7, delta);
        sphereGroup.rotation.x = sphereRotation.current.x;
        sphereGroup.rotation.y = sphereRotation.current.y;
      }
      camera.position.set(0, 0, 0.1);
      camera.lookAt(0, 0, -1);
      const nextFov = THREE.MathUtils.damp(camera.fov, sphereFovTarget.current, 5, delta);
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
      return;
    }

    // OrbitControls owns mouse drag rotation; damping keeps the release motion smooth.
    controlsRef.current?.update(delta);
  });

  return null;
}

function HelixMotionGroup({ enabled, focusActive, children }: { enabled: boolean; focusActive: boolean; children: React.ReactNode }) {
  const { gl } = useThree();
  const ref = useRef<THREE.Group>(null);
  const scrollTarget = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      scrollTarget.current = THREE.MathUtils.clamp(scrollTarget.current + event.deltaY * 0.006, -5.5, 5.5);
    };

    gl.domElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", handleWheel);
  }, [enabled, gl]);

  useFrame((_, delta) => {
    if (ref.current) {
      if (focusActive) {
        scrollTarget.current = 0;
      }
      const nextPositionY = THREE.MathUtils.damp(ref.current.position.y, scrollTarget.current, 5, delta);
      ref.current.position.y = nextPositionY;
      // A point at angle θ reaches y = 0 when scroll = -pitch * θ.
      // With the camera-near phase on +Z, rotating by -θ puts that point on x = 0, so the two values
      // must be coupled to the actual damped translation, not to a separate
      // lagging target, or the scroll motion visibly loses phase.
      ref.current.rotation.y = nextPositionY / HELIX_PITCH_PER_RADIAN;
    }
  });

  return <group ref={ref}>{children}</group>;
}

function StageParticles({ mode }: { mode: PlaybookLayoutMode }) {
  const particlesRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = mode === "orbit" ? 160 : 0;
    const spreadX = 18;
    const spreadY = 10;
    const spreadZ = 22;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const seed = index * 17.371;
      values[index * 3] = (Math.sin(seed) * 0.5 + 0.5) * spreadX - spreadX * 0.5;
      values[index * 3 + 1] = (Math.cos(seed * 0.73) * 0.5 + 0.5) * spreadY - spreadY * 0.5;
      values[index * 3 + 2] = (Math.sin(seed * 0.41) * 0.5 + 0.5) * spreadZ - spreadZ * 0.72;
    }

    return values;
  }, [mode]);

  useFrame((_, delta) => {
    if (!particlesRef.current) {
      return;
    }

    particlesRef.current.rotation.y += delta * 0.045;
  });

  const color = "#c5a9ff";
  const size = 0.065;
  const opacity = 0.68;

  if (mode !== "orbit") {
    return null;
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function PrismLensEffect() {
  const ref = useRef<THREE.Group>(null);
  const ribbons = useMemo(() => [
    { color: "#ff6b9d", offset: 0.35 },
    { color: "#65d6ff", offset: -0.3 },
    { color: "#a78bfa", offset: 0.1 },
  ].map(({ color, offset }) => ({
    color,
    curve: new THREE.CatmullRomCurve3(Array.from({ length: 48 }, (_, index) => {
      const progress = index / 47;
      return new THREE.Vector3(
        -9 + progress * 18,
        Math.sin(progress * Math.PI * 2.2 + offset) * 2.2 + offset * 1.6,
        -2.8 + Math.cos(progress * Math.PI * 1.8 + offset) * 0.35,
      );
    })),
  })), []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.z += delta * 0.025;
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {ribbons.map((ribbon) => (
        <mesh key={ribbon.color}>
          <tubeGeometry args={[ribbon.curve, 96, 0.06, 8, false]} />
          <meshBasicMaterial color={ribbon.color} transparent opacity={0.48} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[-5, 2, 2]} color="#ff6b9d" intensity={6} distance={11} />
      <pointLight position={[5, -2, 2]} color="#65d6ff" intensity={6} distance={11} />
    </group>
  );
}

function StoryMapDistrictInfo({ group, storyCount, selectedGroup, onSelect }: { group: PlaybookGroup; storyCount: number; selectedGroup: PlaybookGroup | null; onSelect: (group: PlaybookGroup) => void }) {
  const ref = useRef<THREE.Group>(null);
  const texture = useMemo(() => makeMapDistrictTexture(group, storyCount, true), [group, storyCount]);
  const isSelected = selectedGroup === group;

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    if (!ref.current.userData.initialized) {
      ref.current.scale.setScalar(0.001);
      ref.current.userData.initialized = true;
    }
    const targetScale = isSelected ? 1.05 : 0.86;
    ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
  });

  return (
    <group ref={ref} position={[getMapDistrictOffset(group)[0], 3.1, 0.5 + getMapDistrictOffset(group)[2]]}>
      {texture ? (
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            onSelect(group);
          }}
        >
          <planeGeometry args={[4.8, 1.34]} />
          <meshBasicMaterial map={texture} transparent opacity={isSelected ? 0.98 : 0.78} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function StoryMapBackdrop({
  playbooks,
  selectedGroup,
  onSelectGroup,
}: {
  playbooks: readonly PlaybookItem[];
  selectedGroup: PlaybookGroup | null;
  onSelectGroup: (group: PlaybookGroup) => void;
}) {
  const roadBlocks = [
    { position: [-5.6, 0, 1.9], size: [13.2, 0.08, 0.34], rotation: -0.18 },
    { position: [4.1, 0, -1.2], size: [10.5, 0.08, 0.34], rotation: 0.22 },
    { position: [-0.5, 0, 0.15], size: [0.34, 0.08, 9.6], rotation: 0.42 },
    { position: [3.5, 0, 1.7], size: [0.34, 0.08, 8.7], rotation: -0.24 },
    { position: [-1.8, 0, -2.7], size: [7.4, 0.08, 0.28], rotation: -0.1 },
  ];
  const visibleMapPlaybooks = playbooks;
  const districtPlaybookCounts = {
    H: visibleMapPlaybooks.filter((playbook) => playbook.group === "H").length,
    GN8: visibleMapPlaybooks.filter((playbook) => playbook.group === "GN8").length,
  };
  const mapAnchors = visibleMapPlaybooks.map((playbook, index) => {
    const districtGroup = selectedGroup === playbook.group ? selectedGroup : playbook.group;
    const districtPlaybooks = visibleMapPlaybooks.filter((item) => item.group === districtGroup);
    const districtIndex = Math.max(0, districtPlaybooks.indexOf(playbook));
    const [x, , z] = getIndexMapSlot(districtIndex, districtPlaybookCounts[districtGroup]);
    const [districtOffsetX, , districtOffsetZ] = getMapDistrictOffset(districtGroup);
    return {
      playbook,
      position: [x + districtOffsetX, 0, z + districtOffsetZ] as Vec3,
      color: ["#6e9cff", "#ef7bb2", "#7fd8c1", "#f3b56b"][districtIndex % 4],
    };
  });
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8.2, 0.11, -2.5),
    new THREE.Vector3(-4.4, 0.11, -0.1),
    new THREE.Vector3(-1.4, 0.11, 1.9),
    new THREE.Vector3(2.6, 0.11, 1.15),
    new THREE.Vector3(7.6, 0.11, 2.65),
  ]);

  return (
    <group>
      <StoryMapDistrictRegion
        group="H"
        storyCount={playbooks.filter((playbook) => playbook.group === "H").length}
        position={[-4.15, 0, 0.1]}
        selectedGroup={selectedGroup}
        onSelect={onSelectGroup}
      />
      <StoryMapDistrictRegion
        group="GN8"
        storyCount={playbooks.filter((playbook) => playbook.group === "GN8").length}
        position={[4.15, 0, 0.1]}
        selectedGroup={selectedGroup}
        onSelect={onSelectGroup}
      />
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI * 0.5, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 20]} />
        <meshStandardMaterial color="#dcebe4" roughness={0.92} metalness={0.02} />
      </mesh>
      <mesh position={[-5.8, -0.045, -1.5]} rotation={[0, 0.02, -0.16]}>
        <boxGeometry args={[4.2, 0.06, 2.45]} />
        <meshStandardMaterial color="#bde6d3" transparent opacity={0.78} roughness={1} />
      </mesh>
      <mesh position={[5.6, -0.045, 2.25]} rotation={[0, 0.02, 0.24]}>
        <boxGeometry args={[3.8, 0.06, 1.8]} />
        <meshStandardMaterial color="#c6e7ee" transparent opacity={0.76} roughness={1} />
      </mesh>
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={`map-street-${index}`} position={[(index - 4) * 2.2, -0.055, 0]}>
          <boxGeometry args={[0.025, 0.025, 14.2]} />
          <meshBasicMaterial color="#b8d2c9" transparent opacity={0.48} />
        </mesh>
      ))}
      {roadBlocks.map((road) => (
        <mesh key={`${road.position.join("-")}`} position={[road.position[0], -0.02, road.position[2]] as Vec3} rotation={[0, road.rotation, 0]}>
          <boxGeometry args={road.size as Vec3} />
          <meshStandardMaterial color="#fbfcf8" roughness={0.86} metalness={0.02} />
        </mesh>
      ))}
      <mesh position={[0, 0.13, 0]}>
        <tubeGeometry args={[route, 96, 0.035, 8, false]} />
        <meshBasicMaterial color="#ef7bb2" transparent opacity={0.74} toneMapped={false} />
      </mesh>
      {mapAnchors.map(({ playbook, position, color }) => (
        <group key={`map-anchor-${playbook.id}`} position={position} raycast={() => null}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.56, 0.68, 0.06, 32]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.84} roughness={0.32} metalness={0.12} />
          </mesh>
          <mesh position={[0, 0.075, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
            <torusGeometry args={[0.47, 0.035, 8, 40]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[[-6.8, 2.65], [0.8, -2.8], [6.2, -2.1]].map(([x, y], index) => (
        <group key={`map-park-${index}`} position={[x, -0.02, y]}>
          <mesh>
            <cylinderGeometry args={[0.74, 0.8, 0.06, 20]} />
            <meshStandardMaterial color={index % 2 ? "#f6d9a9" : "#b7e2cf"} roughness={0.96} />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
            <torusGeometry args={[0.5, 0.025, 8, 36]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.52} />
          </mesh>
        </group>
      ))}
      <StoryMapDistrictInfo
        group="H"
        storyCount={playbooks.filter((playbook) => playbook.group === "H").length}
        selectedGroup={selectedGroup}
        onSelect={onSelectGroup}
      />
      <StoryMapDistrictInfo
        group="GN8"
        storyCount={playbooks.filter((playbook) => playbook.group === "GN8").length}
        selectedGroup={selectedGroup}
        onSelect={onSelectGroup}
      />
    </group>
  );
}

function StageEffects({
  mode,
  playbooks,
  selectedMapGroup,
  onSelectMapGroup,
}: {
  mode: PlaybookLayoutMode;
  playbooks: readonly PlaybookItem[];
  selectedMapGroup: PlaybookGroup | null;
  onSelectMapGroup: (group: PlaybookGroup) => void;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current && mode === "orbit") {
      ref.current.rotation.z -= delta * 0.022;
    }
  });

  return (
    <>
      <StageParticles mode={mode} />
      <WatercolorBackdrop mode={mode} />
      {mode === "index" ? <StoryMapBackdrop playbooks={playbooks} selectedGroup={selectedMapGroup} onSelectGroup={onSelectMapGroup} /> : null}
      {mode === "prism" ? <PrismLensEffect /> : null}
      {mode === "orbit" ? (
        <group ref={ref} position={[0, 0, -0.5]}>
          <mesh>
            <sphereGeometry args={[0.82, 24, 16]} />
            <meshBasicMaterial color="#9c6cff" transparent opacity={0.18} />
          </mesh>
          <pointLight color="#9c6cff" intensity={20} distance={12} />
        </group>
      ) : null}
    </>
  );
}

function StageGuides({ mode, playbooks }: { mode: PlaybookLayoutMode; playbooks: readonly PlaybookItem[] }) {
  if (mode === "solar") {
    return null;
  }

  if (mode === "helix") {
    const curves = HELIX_RAIL_RADII.map((_, railIndex) => new THREE.CatmullRomCurve3(Array.from({ length: 129 }, (_, index) => {
      const progress = index / 128;
      const angle = (progress - 0.5) * HELIX_TOTAL_ANGLE;
      const [x, y, z] = getHelixPoint(railIndex, angle);
      return new THREE.Vector3(x, y, z);
    })));
    return (
      <>
        <mesh>
          <tubeGeometry args={[curves[0], 160, 0.055, 8, false]} />
          <meshBasicMaterial color="#65d6ff" transparent opacity={0.72} toneMapped={false} />
        </mesh>
        <mesh>
          <tubeGeometry args={[curves[1], 160, 0.055, 8, false]} />
          <meshBasicMaterial color="#ff6b9d" transparent opacity={0.72} toneMapped={false} />
        </mesh>
      </>
    );
  }

  if (mode === "sphere") {
    const latitudeCurves = SPHERE_RING_LAYOUT.map(({ latitude }) => new THREE.CatmullRomCurve3(
      Array.from({ length: 96 }, (_, index) => {
        const angle = (index / 95) * Math.PI * 2;
        const horizontalRadius = Math.cos(latitude) * (SPHERE_SURFACE_RADIUS - 0.08);
        return new THREE.Vector3(
          Math.sin(angle) * horizontalRadius,
          Math.sin(latitude) * (SPHERE_SURFACE_RADIUS - 0.08),
          -Math.cos(angle) * horizontalRadius,
        );
      }),
      true,
    ));
    const meridianCurves = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((longitude) => new THREE.CatmullRomCurve3(
      Array.from({ length: 64 }, (_, index) => {
        const latitude = -Math.PI * 0.5 + (index / 63) * Math.PI;
        const horizontalRadius = Math.cos(latitude) * (SPHERE_SURFACE_RADIUS - 0.08);
        return new THREE.Vector3(
          Math.sin(longitude) * horizontalRadius,
          Math.sin(latitude) * (SPHERE_SURFACE_RADIUS - 0.08),
          -Math.cos(longitude) * horizontalRadius,
        );
      }),
      false,
    ));
    return (
      <>
        <mesh renderOrder={0}>
          <sphereGeometry args={[SPHERE_SURFACE_RADIUS, 32, 24]} />
          <meshBasicMaterial color="#d7e3f1" transparent opacity={0.04} side={THREE.BackSide} depthWrite={false} />
        </mesh>
        {latitudeCurves.map((curve, index) => (
          <mesh key={`sphere-latitude-${index}`} renderOrder={1}>
            <tubeGeometry args={[curve, 128, 0.022, 6, true]} />
            <meshBasicMaterial color={index % 2 ? "#ff9fcf" : "#7fd8ff"} transparent opacity={0.34} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
        {meridianCurves.map((curve, index) => (
          <mesh key={`sphere-meridian-${index}`} renderOrder={1}>
            <tubeGeometry args={[curve, 96, 0.018, 6, false]} />
            <meshBasicMaterial color={index % 2 ? "#b9a3ff" : "#8ce8d1"} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
        <pointLight position={[0, 0, -1]} color="#ffffff" intensity={4} distance={10} />
        <pointLight position={[-4, 2, -3]} color="#bde8ff" intensity={8} distance={14} />
        <pointLight position={[4, -2, -3]} color="#ffd0e4" intensity={7} distance={14} />
      </>
    );
  }

  if (mode === "index") {
    return null;
  }

  if (mode === "timeline") {
    const columns = getTimelineColumns(playbooks.length);
    const rows = Math.ceil(playbooks.length / columns);
    const width = Math.max(9, (columns - 1) * 2.28 + 2.6);
    return (
      <>
        {Array.from({ length: rows }, (_, row) => (
          <group key={row} position={[0, getTimelineRowY(row) - 0.76, -row * 2.25]}>
            <mesh rotation={[0, 0, Math.PI * 0.5]}>
              <cylinderGeometry args={[0.045, 0.045, width, 12]} />
              <meshStandardMaterial color={row % 2 ? "#ff9fcf" : "#83b8ff"} emissive={row % 2 ? "#ff4f9a" : "#5279d8"} emissiveIntensity={0.52} metalness={0.28} roughness={0.18} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  if (mode === "orbit") {
    return (
      <>
        {[3.3, 5.15, 7].map((radius, index) => (
          <mesh key={radius} rotation={[Math.PI * 0.5, 0, index * 0.34]}>
            <torusGeometry args={[radius, 0.025, 8, 72]} />
            <meshBasicMaterial color={index % 2 ? "#bd7e54" : "#5279d8"} transparent opacity={0.38} />
          </mesh>
        ))}
        <mesh position={[0, 0, -0.45]}>
          <sphereGeometry args={[0.66, 20, 12]} />
          <meshStandardMaterial color="#d9c7ff" emissive="#754cff" emissiveIntensity={1.35} metalness={0.4} roughness={0.22} />
        </mesh>
      </>
    );
  }

  if (mode === "prism") {
    return null;
  }

  return (
    <>
      {Array.from({ length: Math.min(10, Math.max(4, Math.ceil(playbooks.length / 4))) }, (_, index) => -1.8 - index * 4.15).map((z, index) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[13.2 - index * 1.2, 8.4 - index * 0.72, 0.035]} />
          <meshBasicMaterial color={index % 2 ? "#bd7e54" : "#7397ec"} wireframe transparent opacity={0.34} />
        </mesh>
      ))}
      <mesh position={[0, 0, -6.7]}>
        <boxGeometry args={[0.035, 8.4, 0.035]} />
        <meshBasicMaterial color="#8ea6c4" transparent opacity={0.38} />
      </mesh>
    </>
  );
}

function ComparisonStage({
  mode,
  playbooks,
  prismGroup,
  onOpenPlaybook,
  focusedIds,
  hasQuery,
}: {
  mode: PlaybookLayoutMode;
  playbooks: readonly PlaybookItem[];
  prismGroup: PlaybookGroup | null;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
  focusedIds: ReadonlySet<string>;
  hasQuery: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedViewIndex, setFocusedViewIndex] = useState<number | null>(null);
  const [selectedSolarGroup, setSelectedSolarGroup] = useState<PlaybookGroup | null>(null);
  const [selectedMapGroup, setSelectedMapGroup] = useState<PlaybookGroup | null>(null);
  const hoverClearTimer = useRef<number | null>(null);
  const handleHover = useCallback((index: number | null) => {
    if (hoverClearTimer.current !== null) {
      window.clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }

    if (index !== null) {
      setHoveredIndex(index);
      return;
    }

    hoverClearTimer.current = window.setTimeout(() => {
      setHoveredIndex(null);
      hoverClearTimer.current = null;
    }, 90);
  }, []);

  useEffect(() => {
    setFocusedViewIndex(null);
    setHoveredIndex(null);
    setSelectedSolarGroup(null);
    if (mode !== "index") {
      setSelectedMapGroup(null);
    }
  }, [mode, prismGroup]);

  const handleSelectSolarGroup = useCallback((group: PlaybookGroup) => {
    setSelectedSolarGroup((currentGroup) => (currentGroup === group ? null : group));
    setFocusedViewIndex(null);
    setHoveredIndex(null);
  }, []);

  const handleFocusPlaybook = useCallback((playbook: PlaybookItem, index: number) => {
    if (focusedViewIndex === index) {
      onOpenPlaybook(playbook);
      return;
    }

    setFocusedViewIndex(index);
    setHoveredIndex(index);
  }, [focusedViewIndex, onOpenPlaybook]);

  useEffect(() => () => {
    if (hoverClearTimer.current !== null) {
      window.clearTimeout(hoverClearTimer.current);
    }
  }, []);
  const textureSources = useMemo(
    () => playbooks.map((playbook) => playbook.thumbnailSrc ?? playbook.fallbackThumbnailSrc ?? ""),
    [playbooks],
  );
  const textures = useLoader(THREE.TextureLoader, textureSources);
  const textureByPlaybookId = useMemo(
    () => new Map(playbooks.map((playbook, index) => [playbook.id, textures[index]])),
    [playbooks, textures],
  );

  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  });

  const renderPlaybooks = mode === "prism"
    ? prismGroup
      ? playbooks.filter((playbook) => playbook.group === prismGroup)
      : []
    : playbooks;
  const renderItemCount = mode === "sphere"
    ? Math.max(SPHERE_LAYOUT_COUNT, renderPlaybooks.length)
    : renderPlaybooks.length;
  const renderItems = renderPlaybooks.length === 0
    ? []
    : Array.from({ length: renderItemCount }, (_, index) => ({
      playbook: renderPlaybooks[index % renderPlaybooks.length],
      index,
    }));
  const shadowsEnabled = renderItems.length <= 32;

  const stageBackground = mode === "solar"
    ? "#160b1b"
    : mode === "index"
      ? "#cbded7"
      : mode === "timeline"
        ? "#fff8f2"
        : mode === "orbit"
          ? "#080612"
          : mode === "helix"
            ? "#071526"
            : mode === "sphere"
              ? "#f3f2ef"
              : "#0e1324";
  const keyLightColor = mode === "solar"
    ? "#ffd0e5"
    : mode === "index"
      ? "#ffffff"
      : mode === "timeline"
        ? "#fff5e7"
        : mode === "orbit"
          ? "#d4c4ff"
          : mode === "helix"
            ? "#c6f4ff"
            : mode === "sphere"
              ? "#fffaf2"
              : "#d6e4ff";
  const lightStage = mode === "index" || mode === "timeline";
  const transparentStage = mode === "sphere";
  const sphereGroupRef = useRef<THREE.Group>(null);

  return (
    <>
      {!transparentStage ? <color attach="background" args={[stageBackground]} /> : null}
      <ambientLight intensity={lightStage ? 1.45 : mode === "sphere" ? 1.08 : mode === "prism" ? 0.72 : mode === "helix" ? 0.82 : mode === "orbit" ? 0.8 : 0.7} />
      <directionalLight position={[-5, 8, 8]} color={keyLightColor} intensity={mode === "prism" ? 3.5 : 3.7} castShadow={shadowsEnabled} />
      <pointLight position={[0, 0, 4]} color={mode === "solar" ? "#ff83bd" : mode === "orbit" ? "#a881ff" : mode === "timeline" ? "#ff9edc" : mode === "index" ? "#8bdcff" : mode === "helix" ? "#65d6ff" : mode === "sphere" ? "#ffd5e1" : "#9f87ff"} intensity={lightStage ? 9 : mode === "sphere" ? 6 : mode === "solar" || mode === "orbit" ? 10 : 7} distance={14} />
      {mode === "index" ? <pointLight position={[-5, 2, 2]} color="#ff9fcf" intensity={8} distance={12} /> : null}
      {mode === "timeline" ? <pointLight position={[5, -2, 1]} color="#9e8cff" intensity={8} distance={12} /> : null}
      <StageEffects mode={mode} playbooks={playbooks} selectedMapGroup={selectedMapGroup} onSelectMapGroup={setSelectedMapGroup} />
      <HelixMotionGroup enabled={mode === "helix"} focusActive={focusedViewIndex !== null}>
        <mesh
          position={[0, 0, -12]}
          onClick={(event) => {
            event.stopPropagation();
            setFocusedViewIndex(null);
            setHoveredIndex(null);
            if (mode === "index") {
              setSelectedMapGroup(null);
            }
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <StageGuides mode={mode} playbooks={playbooks} />
        <group ref={sphereGroupRef}>
          {mode === "solar" ? (
            <SolarSystemStage
              playbooks={playbooks}
              textures={textures}
              selectedGroup={selectedSolarGroup}
              hoveredIndex={hoveredIndex}
              focusedIds={focusedIds}
              focusedViewIndex={focusedViewIndex}
              onSelectGroup={handleSelectSolarGroup}
              onHover={handleHover}
              onFocusPlaybook={handleFocusPlaybook}
            />
          ) : (
            <>
              <CoreCube mode={mode} />
              {renderItems.map(({ playbook, index }) => (
                <PlaybookObject
                  key={`${playbook.id}-${index}`}
                  playbook={playbook}
                  index={index}
                  mode={mode}
                  visiblePlaybooks={renderPlaybooks}
                  mapDistrictGroup={mode === "index" && playbook.group === selectedMapGroup ? selectedMapGroup : null}
                  mapOverview={mode === "index" && playbook.group !== selectedMapGroup && focusedViewIndex === null}
                  shadowsEnabled={shadowsEnabled}
                  texture={textureByPlaybookId.get(playbook.id) ?? textures[0]}
                  hovered={hoveredIndex === index}
                  focused={focusedIds.has(playbook.id)}
                  hasQuery={hasQuery}
                  selected={hoveredIndex === index}
                  hasSelection={hoveredIndex !== null}
                  focusedView={focusedViewIndex === index}
                  hasFocusedView={focusedViewIndex !== null}
                  onHover={handleHover}
                  onFocusPlaybook={handleFocusPlaybook}
                />
              ))}
            </>
          )}
        </group>
      </HelixMotionGroup>
      <OrbitController mode={mode} sphereGroupRef={sphereGroupRef} />
    </>
  );
}

export function PlaybookLayoutView({ mode, playbookGroup, onOpenPlaybook }: PlaybookLayoutViewProps) {
  const allPlaybooks = getVisiblePlaybooks(playbookGroup);
  const [query, setQuery] = useState("");
  const [prismChapterGroup, setPrismChapterGroup] = useState<PlaybookGroup | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const focusedIds = useMemo(() => new Set(
    allPlaybooks
      .filter((playbook) => !normalizedQuery || [playbook.id, playbook.title, ...playbook.tags].join(" ").toLowerCase().includes(normalizedQuery))
      .map((playbook) => playbook.id),
  ), [allPlaybooks, normalizedQuery]);
  const playbooks = allPlaybooks;

  useEffect(() => {
    if (mode !== "prism") {
      setPrismChapterGroup(null);
    }
  }, [mode]);
  const title = mode === "solar"
    ? "SOLAR SYSTEM"
    : mode === "index"
      ? "STORY MAP"
      : mode === "prism"
        ? "PRISM LENS"
        : mode === "helix"
          ? "HELIX"
          : mode === "sphere"
            ? "SPHERE"
        : mode === "timeline"
          ? "STORY RIBBON"
          : "FOCUS ORBIT";
  const description = mode === "solar"
    ? "H와 GN8 행성을 고르면 해당 스토리계가 중앙으로 전개됩니다"
    : mode === "index"
      ? "지도를 이동하고 확대하며 스토리 클러스터에서 개별 이야기로 내려갑니다"
      : mode === "prism"
        ? "카드를 고르면 유리층 밖으로 끌어내어 내용을 확인합니다"
        : mode === "helix"
          ? "스크롤로 세로 소용돌이를 오르내리며 플레이북을 만납니다"
          : mode === "sphere"
            ? "구 안에 서서 내부 스플라인을 따라 플레이북을 훑습니다"
        : mode === "timeline"
          ? "스토리를 한 줄의 리본처럼 훑고 현재 위치를 포커스합니다"
          : "선택한 스토리를 중앙으로 끌어올리고 주변 궤도를 비교합니다";
  const interactionHint = mode === "index" ? "드래그 이동 / 스크롤 줌" : "드래그 회전 / 스크롤 줌";

  return (
    <main className={`playbook-layout playbook-layout--${mode}`} data-layout-mode={mode}>
      <div className="playbook-layout__backdrop" aria-hidden="true" />
      <div className="playbook-3d-layout__header">
        <strong>{title}</strong>
        <span>{mode === "sphere"
          ? `${allPlaybooks.length} STORIES · INSIDE VIEW · DRAG LOOK · SCROLL ZOOM · CLICK FOCUS`
          : `${description} · ${mode === "index" && normalizedQuery ? `${focusedIds.size}/${allPlaybooks.length}개` : `${allPlaybooks.length}개`} 스토리 · ${interactionHint} / 첫 클릭 포커스 / 두 번째 클릭 열기`}
        </span>
      </div>
      {mode === "index" ? (
        <label className="playbook-3d-layout__finder">
          <span>FIND STORY</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ID, 제목, 태그 검색"
            aria-label="스토리 검색"
          />
        </label>
      ) : null}
      {mode === "prism" ? (
        <PrismChapterPanel
          playbooks={playbooks}
          selectedGroup={prismChapterGroup}
          onSelectGroup={setPrismChapterGroup}
        />
      ) : null}
      <div className="playbook-3d-layout__canvas" aria-label="tosun 3D 비교 스테이지">
        <Canvas
          key={mode}
          camera={{ position: mode === "sphere" ? [0, 0, 0.1] : mode === "helix" ? [0, 0, getCameraDistance(mode, playbooks)] : [0, mode === "index" ? 12.8 : 0.45, getCameraDistance(mode, playbooks)], fov: mode === "sphere" ? 68 : mode === "index" ? 50 : 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: mode === "sphere" }}
          shadows={playbooks.length <= 24}
          fallback={<div className="playbook-3d-layout__fallback">3D 화면을 불러오는 중입니다.</div>}
          onPointerMissed={() => undefined}
        >
          <ComparisonStage mode={mode} playbooks={playbooks} prismGroup={mode === "prism" ? prismChapterGroup : null} focusedIds={focusedIds} hasQuery={mode === "index" && Boolean(normalizedQuery)} onOpenPlaybook={onOpenPlaybook} />
        </Canvas>
      </div>
    </main>
  );
}
