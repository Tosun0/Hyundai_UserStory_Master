// @ts-nocheck
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

export type PlaybookLayoutMode = "solar" | "city" | "tunnel";

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

function getCityFeatures(playbooks: readonly PlaybookItem[]) {
  return Array.from(new Set(playbooks.map((item) => Number(item.cubeKey.split(",")[0])))).sort((a, b) => a - b);
}

function getCityPosition(playbook: PlaybookItem, visiblePlaybooks: readonly PlaybookItem[]): Vec3 {
  const [feature] = playbook.cubeKey.split(",").map(Number);
  const features = getCityFeatures(visiblePlaybooks);
  const featureIndex = features.indexOf(feature);
  const towerItems = visiblePlaybooks
    .filter((item) => Number(item.cubeKey.split(",")[0]) === feature)
    .slice()
    .sort((a, b) => a.cubeKey.localeCompare(b.cubeKey));
  const towerIndex = towerItems.findIndex((item) => item.id === playbook.id);
  const x = (featureIndex - (features.length - 1) / 2) * 3.1;
  const groupOffset = playbook.group === "H" ? -0.72 : 0.72;
  return [x + groupOffset, -3.05 + towerIndex * 1.55, playbook.group === "H" ? 0.45 : -0.45];
}

function getCameraDistance(mode: PlaybookLayoutMode, playbooks: readonly PlaybookItem[]) {
  const playbookCount = playbooks.length;

  if (mode === "solar") {
    return 17.5 + Math.max(0, Math.ceil(playbookCount / 8) - 1) * 1.65;
  }

  if (mode === "tunnel") {
    return 17.5 + Math.min(14, Math.max(0, Math.ceil(playbookCount / 4) - 3) * 0.6);
  }

  const featureCount = getCityFeatures(playbooks).length;
  return 17.5 + Math.min(12, Math.max(0, featureCount - 6) * 1.3);
}

function cubePosition(
  playbook: PlaybookItem,
  index: number,
  mode: PlaybookLayoutMode,
  visiblePlaybooks: readonly PlaybookItem[],
): Vec3 {
  const [feature, groupAxis, story] = playbook.cubeKey.split(",").map(Number);

  if (mode === "solar") {
    return getSolarPosition(index);
  }

  if (mode === "city") {
    return getCityPosition(playbook, visiblePlaybooks);
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

function PlaybookCube({
  playbook,
  index,
  mode,
  visiblePlaybooks,
  shadowsEnabled,
  texture,
  onOpenPlaybook,
  onHover,
  hovered,
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
}) {
  const groupRef = useRef<THREE.Group>(null);
  const basePosition = useMemo(
    () => cubePosition(playbook, index, mode, visiblePlaybooks),
    [index, mode, playbook, visiblePlaybooks],
  );
  const sideColor = playbook.group === "H" ? "#6d89bd" : "#b88763";
  const layoutScale = mode === "city" ? 0.76 : mode === "tunnel" ? 0.74 : 0.9;
  const baseRotation = useMemo<Vec3>(
    () => [0.08 + (index % 3) * 0.035, -0.18 + (index % 4) * 0.08, 0],
    [index],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const targetScale = layoutScale * (hovered ? 1.18 : 1);
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
  });

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
      <mesh castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
        <boxGeometry args={[1.72, 1.72, 0.42]} />
        <meshStandardMaterial attach="material-0" color={sideColor} roughness={0.42} metalness={0.35} />
        <meshStandardMaterial attach="material-1" color={sideColor} roughness={0.42} metalness={0.35} />
        <meshStandardMaterial attach="material-2" color="#d9e6f7" roughness={0.28} metalness={0.2} />
        <meshStandardMaterial attach="material-3" color="#273647" roughness={0.62} metalness={0.22} />
        <meshStandardMaterial attach="material-4" map={texture} roughness={0.55} metalness={0.08} />
        <meshStandardMaterial attach="material-5" color="#18232d" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.225]}>
        <planeGeometry args={[1.55, 1.55]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
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

  if (mode === "city") {
    const features = getCityFeatures(playbooks);
    const highestTower = Math.max(1, ...features.map((feature) => playbooks.filter((item) => Number(item.cubeKey.split(",")[0]) === feature).length));
    return (
      <>
        <gridHelper args={[16, 8, "#7d9bd2", "#c5d1e2"]} position={[0, -4.05, 0]} />
        {features.map((feature, featureIndex) => (
          <mesh key={feature} position={[(featureIndex - (features.length - 1) / 2) * 3.1, -3.98, 0]}>
            <boxGeometry args={[1.72, 0.12, 2.8]} />
            <meshStandardMaterial color="#c6d6ee" transparent opacity={0.48} roughness={0.36} metalness={0.18} />
          </mesh>
        ))}
        {features.map((feature, featureIndex) => (
          <mesh key={`tower-${feature}`} position={[(featureIndex - (features.length - 1) / 2) * 3.1, -3.05 + (highestTower - 1) * 0.775, -0.45]}>
            <boxGeometry args={[0.045, Math.max(1.2, highestTower * 1.55), 0.045]} />
            <meshBasicMaterial color="#86a7d9" transparent opacity={0.42} />
          </mesh>
        ))}
        <mesh position={[0, -3.86, 0]}>
          <boxGeometry args={[16.8, 0.07, 0.42]} />
          <meshStandardMaterial color="#8aa1bf" transparent opacity={0.46} roughness={0.46} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, -1.2]}>
          <boxGeometry args={[15.8, 0.035, 0.035]} />
          <meshBasicMaterial color="#8ea6c4" transparent opacity={0.55} />
        </mesh>
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
}: {
  mode: PlaybookLayoutMode;
  playbooks: readonly PlaybookItem[];
  onOpenPlaybook: (playbook: PlaybookItem) => void;
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
          <PlaybookCube
            key={playbook.id}
            playbook={playbook}
            index={index}
            mode={mode}
            visiblePlaybooks={playbooks}
            shadowsEnabled={shadowsEnabled}
            texture={textures[index]}
            hovered={hoveredId === playbook.id}
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
  const playbooks = getVisiblePlaybooks(playbookGroup);
  const title = mode === "solar" ? "SOLAR BURST" : mode === "city" ? "CUBE CITY" : "DEEP SPACE TUNNEL";
  const description = mode === "solar"
    ? "중앙 코어를 중심으로 스토리가 방사됩니다"
    : mode === "city"
      ? "기능과 스토리를 타워처럼 쌓아 비교합니다"
      : "스토리 큐브가 깊이 방향으로 이어지는 탐색 공간입니다";

  return (
    <main className={`playbook-layout playbook-layout--${mode}`} data-layout-mode={mode}>
      <div className="playbook-layout__backdrop" aria-hidden="true" />
      <div className="playbook-3d-layout__header">
        <strong>{title}</strong>
        <span>{description} · {playbooks.length}개 스토리 · 드래그 회전 / 스크롤 줌 / 큐브 클릭</span>
      </div>
      <div className="playbook-3d-layout__canvas" aria-label="tosun 3D 비교 큐브">
        <Canvas
          key={`${mode}-${playbooks.length}`}
          camera={{ position: [0, 0.45, getCameraDistance(mode, playbooks)], fov: 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          shadows={playbooks.length <= 24}
          fallback={<div className="playbook-3d-layout__fallback">3D 화면을 불러오는 중입니다.</div>}
        >
          <ComparisonStage mode={mode} playbooks={playbooks} onOpenPlaybook={onOpenPlaybook} />
        </Canvas>
      </div>
    </main>
  );
}
