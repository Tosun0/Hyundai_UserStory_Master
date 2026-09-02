// @ts-nocheck
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

export type PlaybookLayoutMode = "solar" | "index" | "tunnel" | "timeline" | "orbit" | "focus";

type PlaybookLayoutViewProps = {
  mode: PlaybookLayoutMode;
  playbookGroup: PlaybookAccessGroup;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
};

type Vec3 = [number, number, number];

const TUNNEL_PATTERNS: readonly (readonly Vec3[])[] = [
  [[-5.2, 2.55, 0], [-1.75, -2.45, 0], [1.75, 2.45, 0], [5.2, -2.55, 0]],
  [[-4.25, -1.9, 0], [-1.05, 1.9, 0], [1.05, -1.9, 0], [4.25, 1.9, 0]],
  [[-3.25, 1.25, 0], [-0.78, -1.25, 0], [0.78, 1.25, 0], [3.25, -1.25, 0]],
  [[-4.8, -2.35, 0], [-1.65, 2.35, 0], [1.65, -2.35, 0], [4.8, 2.35, 0]],
];

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

function getIndexColumns(playbookCount: number) {
  return Math.min(8, Math.max(4, Math.ceil(Math.sqrt(Math.max(1, playbookCount) * 1.35))));
}

function getIndexPosition(index: number, playbookCount: number): Vec3 {
  const columns = getIndexColumns(playbookCount);
  const rows = Math.ceil(playbookCount / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [
    (column - (columns - 1) / 2) * 2.42,
    ((rows - 1) / 2 - row) * 1.75 - 0.2,
    (column % 2 ? 0.28 : -0.28) + (row % 3 - 1) * 0.1,
  ];
}

function getTimelinePosition(index: number, playbookCount: number): Vec3 {
  const columns = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(Math.max(1, playbookCount)))));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [
    (column - (columns - 1) / 2) * 2.35,
    row % 2 ? 1.1 : -1.1,
    -row * 1.5 + (column % 2 ? 0.18 : -0.18),
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

function getFocusStackPosition(index: number): Vec3 {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return [
    (column - 1.5) * 1.35 + row * 0.32,
    (1.5 - column) * 0.18 - row * 0.06,
    1.1 - index * 0.72,
  ];
}

function getCameraDistance(mode: PlaybookLayoutMode, playbooks: readonly PlaybookItem[]) {
  const playbookCount = playbooks.length;

  if (mode === "solar") {
    return 17.5 + Math.max(0, Math.ceil(playbookCount / 8) - 1) * 1.65;
  }

  if (mode === "tunnel") {
    return 17.5 + Math.min(14, Math.max(0, Math.ceil(playbookCount / 4) - 3) * 0.6);
  }

  if (mode === "index") {
    const rows = Math.ceil(playbooks.length / getIndexColumns(playbooks.length));
    return 17.5 + Math.min(14, Math.max(0, rows - 3) * 1.35);
  }

  if (mode === "timeline") {
    return 18.5 + Math.min(10, Math.max(0, Math.ceil(playbooks.length / 5) - 2) * 1.2);
  }

  if (mode === "focus") {
    return 15.5 + Math.min(8, Math.max(0, Math.ceil(playbooks.length / 4) - 3) * 0.8);
  }

  return 18.5 + Math.min(6, Math.max(0, Math.ceil(playbooks.length / 6) - 2) * 0.65);
}

function cubePosition(
  playbook: PlaybookItem,
  index: number,
  mode: PlaybookLayoutMode,
  visiblePlaybooks: readonly PlaybookItem[],
): Vec3 {
  const [, groupAxis] = playbook.cubeKey.split(",").map(Number);

  if (mode === "solar") {
    return getSolarPosition(index);
  }

  if (mode === "index") {
    return getIndexPosition(index, visiblePlaybooks.length);
  }

  if (mode === "timeline") {
    return getTimelinePosition(index, visiblePlaybooks.length);
  }

  if (mode === "orbit") {
    return getOrbitPosition(index);
  }

  if (mode === "focus") {
    return getFocusStackPosition(index);
  }

  const layer = Math.floor(index / 4);
  const lane = TUNNEL_PATTERNS[layer % TUNNEL_PATTERNS.length][index % 4];
  const depth = -1.5 - layer * 4.15;
  return [
    lane[0],
    lane[1],
    depth + (groupAxis - 3.5) * 0.28,
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

function PlaybookObject({
  playbook,
  index,
  mode,
  visiblePlaybooks,
  shadowsEnabled,
  texture,
  onOpenPlaybook,
  onHover,
  hovered,
  focused,
  hasQuery,
}: {
  playbook: PlaybookItem;
  index: number;
  mode: PlaybookLayoutMode;
  visiblePlaybooks: readonly PlaybookItem[];
  shadowsEnabled: boolean;
  texture: THREE.Texture;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
  onHover: (playbook: PlaybookItem | null) => void;
  hovered: boolean;
  focused: boolean;
  hasQuery: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const basePosition = useMemo(
    () => cubePosition(playbook, index, mode, visiblePlaybooks),
    [index, mode, playbook, visiblePlaybooks],
  );
  const sideColor = playbook.group === "H" ? "#6d89bd" : "#b88763";
  const isIndex = mode === "index";
  const layoutScale = isIndex ? 0.86 : mode === "tunnel" ? 0.74 : mode === "focus" ? 0.82 : 0.9;
  const baseRotation = useMemo<Vec3>(
    () => isIndex
      ? [0.025 + (index % 2) * 0.018, -0.05 + (index % 3) * 0.025, 0]
      : mode === "timeline"
        ? [0.02, index % 2 ? -0.08 : 0.08, index % 2 ? -0.04 : 0.04]
      : [0.08 + (index % 3) * 0.035, -0.18 + (index % 4) * 0.08, 0],
    [index, isIndex, mode],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const focusOffset = isIndex && hasQuery && focused ? 1.25 : 0;
    const targetScale = layoutScale * (hovered ? 1.18 : 1) * (isIndex && hasQuery && !focused ? 0.82 : 1);
    group.position.lerp(new THREE.Vector3(basePosition[0], basePosition[1], basePosition[2] + focusOffset), 1 - Math.pow(0.001, delta));
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
  });

  const opacity = isIndex && hasQuery && !focused ? 0.16 : 1;
  const transparent = isIndex && hasQuery;

  const material = (map?: THREE.Texture) => ({
    color: sideColor,
    map,
    transparent,
    opacity,
    roughness: 0.42,
    metalness: 0.35,
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

    if (mode === "timeline") {
      return (
        <>
          <mesh rotation={[Math.PI * 0.5, 0, 0]} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <cylinderGeometry args={[0.76, 0.76, 0.46, 10]} />
            <meshStandardMaterial {...material()} roughness={0.32} metalness={0.52} />
          </mesh>
          <mesh position={[0, 0, 0.245]}>
            <circleGeometry args={[0.6, 32]} />
            <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.26]}>
            <ringGeometry args={[0.62, 0.7, 32]} />
            <meshBasicMaterial color={playbook.group === "H" ? "#5279d8" : "#bd7e54"} transparent opacity={0.9 * opacity} />
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

    if (mode === "focus") {
      return (
        <>
          <mesh rotation={[0.18, -0.22, 0.08]} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <octahedronGeometry args={[1.02, 0]} />
            <meshStandardMaterial {...material()} roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.58]} rotation={[0.08, -0.12, 0.08]}>
            <planeGeometry args={[1.18, 0.8]} />
            <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} toneMapped={false} />
          </mesh>
        </>
      );
    }

    if (mode === "tunnel") {
      return (
        <>
          <mesh rotation={[0.15, 0.28, 0.08]} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <coneGeometry args={[0.86, 1.48, 4]} />
            <meshStandardMaterial {...material()} roughness={0.34} metalness={0.44} />
          </mesh>
          <mesh position={[0, 0, 0.52]} rotation={[0.02, -0.12, 0.08]}>
            <planeGeometry args={[1.08, 0.72]} />
            <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} toneMapped={false} />
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
        onOpenPlaybook(playbook);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        onHover(playbook);
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        onHover(null);
      }}
    >
      {renderShape()}
      {isIndex ? <mesh position={[0, -0.57, 0.4]}>
        <boxGeometry args={[1.84, 0.055, 0.035]} />
        <meshBasicMaterial color={focused || !hasQuery ? (playbook.group === "H" ? "#5279d8" : "#bd7e54") : "#9aa8b8"} transparent opacity={opacity} />
      </mesh> : null}
      <InfoPanel playbook={playbook} visible={hovered} />
    </group>
  );
}

function CoreCube({ mode }: { mode: PlaybookLayoutMode }) {
  const ref = useRef<THREE.Mesh>(null);

  if (mode !== "solar") {
    return null;
  }

  return (
    <group position={[0, 0, -0.7]}>
      <mesh ref={ref} rotation={[0.32, -0.42, 0]}>
        <icosahedronGeometry args={[1.28, 2]} />
        <meshStandardMaterial color="#79a4ff" transparent opacity={0.18} roughness={0.16} metalness={0.55} wireframe />
      </mesh>
      <mesh rotation={[-0.1, 0.5, 0.2]}>
        <boxGeometry args={[2.8, 2.8, 0.035]} />
        <meshBasicMaterial color="#78a6ff" transparent opacity={0.22} wireframe />
      </mesh>
      <pointLight color="#7ea9ff" intensity={13} distance={9} />
    </group>
  );
}

function OrbitController() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 10;
    controls.maxDistance = 28;
    controls.rotateSpeed = 0.55;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    // OrbitControls owns mouse drag rotation; damping keeps the release motion smooth.
    controlsRef.current?.update(delta);
  });

  return null;
}

function StageGuides({ mode, playbooks }: { mode: PlaybookLayoutMode; playbooks: readonly PlaybookItem[] }) {
  if (mode === "solar") {
    return (
      <>
        {playbooks.slice(0, 16).map((_, slotIndex) => {
          const [x, y, z] = getSolarPosition(slotIndex);
          return <mesh key={slotIndex} position={[x * 0.68, y * 0.68, z - 0.2]} rotation={[0, 0, Math.atan2(y, x)]}>
            <boxGeometry args={[Math.hypot(x, y) * 0.44, 0.018, 0.018]} />
            <meshBasicMaterial color={slotIndex % 2 ? "#bd7e54" : "#5279d8"} transparent opacity={0.32} />
          </mesh>;
        })}
      </>
    );
  }

  if (mode === "index") {
    const columns = getIndexColumns(playbooks.length);
    const rows = Math.ceil(playbooks.length / columns);
    const width = Math.max(8, (columns - 1) * 2.42 + 3.2);
    return (
      <>
        <mesh position={[0, 0, -1.35]}>
          <boxGeometry args={[width, Math.max(5.2, rows * 1.75 + 0.8), 0.05]} />
          <meshBasicMaterial color="#9bb2d1" transparent opacity={0.2} wireframe />
        </mesh>
        {Array.from({ length: rows + 1 }, (_, row) => ((rows - 1) / 2 - row + 0.5) * 1.75 - 0.2).map((y) => (
          <mesh key={y} position={[0, y, -1.08]}>
          <boxGeometry args={[width, 0.04, 0.04]} />
            <meshBasicMaterial color="#7599d2" transparent opacity={0.46} />
          </mesh>
        ))}
        <mesh position={[0, -3.85, 0]}>
          <boxGeometry args={[width + 1.2, 0.08, 2.2]} />
          <meshStandardMaterial color="#d2deef" transparent opacity={0.58} roughness={0.34} metalness={0.18} />
        </mesh>
      </>
    );
  }

  if (mode === "timeline") {
    const columns = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(Math.max(1, playbooks.length)))));
    const rows = Math.ceil(playbooks.length / columns);
    const width = Math.max(9, (columns - 1) * 2.35 + 3);
    return (
      <>
        {Array.from({ length: rows }, (_, row) => (
          <group key={row} position={[0, row % 2 ? 1.1 : -1.1, -row * 1.5]}>
            <mesh>
              <boxGeometry args={[width, 0.08, 0.08]} />
              <meshStandardMaterial color={row % 2 ? "#bd7e54" : "#5279d8"} emissive={row % 2 ? "#5f2712" : "#172d68"} emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[width / 2 - 0.35, 0, 0]} rotation={[0, 0, row % 2 ? -0.55 : 0.55]}>
              <coneGeometry args={[0.18, 0.48, 4]} />
              <meshBasicMaterial color={row % 2 ? "#bd7e54" : "#5279d8"} />
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
          <meshStandardMaterial color="#d9e6f7" emissive="#6d89bd" emissiveIntensity={0.9} metalness={0.4} roughness={0.22} />
        </mesh>
      </>
    );
  }

  if (mode === "focus") {
    return (
      <>
        {Array.from({ length: Math.min(10, Math.max(4, playbooks.length)) }, (_, index) => (
          <mesh key={index} position={[0, 0, 0.45 - index * 0.72]} rotation={[0.02, 0, index % 2 ? -0.025 : 0.025]}>
            <boxGeometry args={[7.8 - index * 0.32, 5.1 - index * 0.22, 0.025]} />
            <meshBasicMaterial color={index % 2 ? "#bd7e54" : "#5279d8"} transparent opacity={0.22 - index * 0.012} wireframe />
          </mesh>
        ))}
      </>
    );
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
  onOpenPlaybook,
  focusedIds,
  hasQuery,
}: {
  mode: PlaybookLayoutMode;
  playbooks: readonly PlaybookItem[];
  onOpenPlaybook: (playbook: PlaybookItem) => void;
  focusedIds: ReadonlySet<string>;
  hasQuery: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<PlaybookItem["id"] | null>(null);
  const textureSources = useMemo(
    () => playbooks.map((playbook) => playbook.thumbnailSrc ?? playbook.fallbackThumbnailSrc ?? ""),
    [playbooks],
  );
  const textures = useLoader(THREE.TextureLoader, textureSources);
  const shadowsEnabled = playbooks.length <= 24;

  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  });

  return (
    <>
      <color attach="background" args={["#edf2f5"]} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[-5, 8, 8]} intensity={4.2} castShadow={shadowsEnabled} />
      <pointLight position={[0, 0, 4]} color="#8ab4ff" intensity={8} distance={14} />
      <StageGuides mode={mode} playbooks={playbooks} />
      <group>
        <CoreCube mode={mode} />
        {playbooks.map((playbook, index) => (
            <PlaybookObject
            key={playbook.id}
            playbook={playbook}
            index={index}
            mode={mode}
            visiblePlaybooks={playbooks}
            shadowsEnabled={shadowsEnabled}
            texture={textures[index]}
            hovered={hoveredId === playbook.id}
            focused={focusedIds.has(playbook.id)}
            hasQuery={hasQuery}
            onHover={(item) => setHoveredId(item?.id ?? null)}
            onOpenPlaybook={onOpenPlaybook}
          />
        ))}
      </group>
      <OrbitController />
    </>
  );
}

export function PlaybookLayoutView({ mode, playbookGroup, onOpenPlaybook }: PlaybookLayoutViewProps) {
  const allPlaybooks = getVisiblePlaybooks(playbookGroup);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const focusedIds = useMemo(() => new Set(
    allPlaybooks
      .filter((playbook) => !normalizedQuery || [playbook.id, playbook.title, ...playbook.tags].join(" ").toLowerCase().includes(normalizedQuery))
      .map((playbook) => playbook.id),
  ), [allPlaybooks, normalizedQuery]);
  const playbooks = allPlaybooks;
  const title = mode === "solar"
    ? "SOLAR BURST"
    : mode === "index"
      ? "STORY INDEX"
      : mode === "tunnel"
        ? "DEEP SPACE TUNNEL"
        : mode === "timeline"
          ? "TIMELINE RAIL"
          : mode === "orbit"
            ? "ORBIT RINGS"
            : "FOCUS STACK";
  const description = mode === "solar"
    ? "중앙 코어를 중심으로 스토리가 방사됩니다"
    : mode === "index"
      ? "전체를 훑고 검색 결과를 앞으로 당겨 바로 들어갑니다"
      : mode === "tunnel"
        ? "스토리 큐브가 깊이 방향으로 이어지는 탐색 공간입니다"
        : mode === "timeline"
          ? "스토리를 순서와 레일 단위로 빠르게 훑습니다"
          : mode === "orbit"
            ? "그룹과 스토리가 동심 궤도로 분리됩니다"
            : "검색하거나 호버한 스토리를 전면으로 꺼냅니다";

  return (
    <main className={`playbook-layout playbook-layout--${mode}`} data-layout-mode={mode}>
      <div className="playbook-layout__backdrop" aria-hidden="true" />
      <div className="playbook-3d-layout__header">
        <strong>{title}</strong>
        <span>{description} · {mode === "index" && normalizedQuery ? `${focusedIds.size}/${allPlaybooks.length}개` : `${allPlaybooks.length}개`} 스토리 · 드래그 회전 / 스크롤 줌 / 오브젝트 클릭</span>
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
      <div className="playbook-3d-layout__canvas" aria-label="tosun 3D 비교 스테이지">
        <Canvas
          key={mode}
          camera={{ position: [0, 0.45, getCameraDistance(mode, playbooks)], fov: 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          shadows={playbooks.length <= 24}
          fallback={<div className="playbook-3d-layout__fallback">3D 화면을 불러오는 중입니다.</div>}
        >
          <ComparisonStage mode={mode} playbooks={playbooks} focusedIds={focusedIds} hasQuery={mode === "index" && Boolean(normalizedQuery)} onOpenPlaybook={onOpenPlaybook} />
        </Canvas>
      </div>
    </main>
  );
}
