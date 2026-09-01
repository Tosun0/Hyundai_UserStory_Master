// @ts-nocheck
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

export type PlaybookLayoutMode = "constellation" | "ring" | "matrix";

type PlaybookLayoutViewProps = {
  mode: PlaybookLayoutMode;
  playbookGroup: PlaybookAccessGroup;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
};

type Vec3 = [number, number, number];

function getVisiblePlaybooks(group: PlaybookAccessGroup) {
  return group === "ALL"
    ? PLAYBOOK_CATALOG
    : PLAYBOOK_CATALOG.filter((playbook) => playbook.group === group);
}

function cubePosition(playbook: PlaybookItem, index: number, mode: PlaybookLayoutMode): Vec3 {
  const [feature, groupAxis, story] = playbook.cubeKey.split(",").map(Number);

  if (mode === "constellation") {
    const angle = (index / PLAYBOOK_CATALOG.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 4.4 + (index % 3) * 0.35;
    return [Math.cos(angle) * radius, Math.sin(angle) * 2.8, (story - 2) * 0.72];
  }

  if (mode === "ring") {
    const groupItems = PLAYBOOK_CATALOG.filter((item) => item.group === playbook.group);
    const groupIndex = groupItems.findIndex((item) => item.id === playbook.id);
    const angle = (groupIndex / groupItems.length) * Math.PI * 2 - Math.PI / 2;
    const centerX = playbook.group === "H" ? -3.2 : 3.2;
    return [centerX + Math.cos(angle) * 2.35, Math.sin(angle) * 2.65, (feature - 2.5) * 0.32];
  }

  return [(feature - 2.5) * 1.25, (2.5 - story) * 1.05, (groupAxis - 3.5) * 0.6];
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

function InfoPanel({ playbook }: { playbook: PlaybookItem }) {
  const texture = useMemo(() => makeInfoTexture(playbook), [playbook]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) {
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
  texture,
  onOpenPlaybook,
  onHover,
  hovered,
}: {
  playbook: PlaybookItem;
  index: number;
  mode: PlaybookLayoutMode;
  texture: THREE.Texture;
  onOpenPlaybook: (playbook: PlaybookItem) => void;
  onHover: (playbook: PlaybookItem | null) => void;
  hovered: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const basePosition = useMemo(() => cubePosition(playbook, index, mode), [index, mode, playbook]);
  const sideColor = playbook.group === "H" ? "#6d89bd" : "#b88763";
  const baseRotation = useMemo<Vec3>(
    () => [0.08 + (index % 3) * 0.035, -0.18 + (index % 4) * 0.08, 0],
    [index],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const targetScale = hovered ? 1.18 : 1;
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
      <mesh castShadow receiveShadow>
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
      <InfoPanel playbook={playbook} />
    </group>
  );
}

function CoreCube({ mode }: { mode: PlaybookLayoutMode }) {
  const ref = useRef<THREE.Mesh>(null);

  if (mode === "matrix") {
    return null;
  }

  return (
    <mesh ref={ref} position={[0, 0, -0.6]} rotation={[0.32, -0.42, 0]}>
      <boxGeometry args={[1.3, 1.3, 1.3]} />
      <meshStandardMaterial color="#dce9ff" transparent opacity={0.2} roughness={0.16} metalness={0.55} wireframe />
    </mesh>
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
  const stageRef = useRef<THREE.Group>(null);
  const textureSources = useMemo(
    () => playbooks.map((playbook) => playbook.thumbnailSrc ?? playbook.fallbackThumbnailSrc ?? ""),
    [playbooks],
  );
  const textures = useLoader(THREE.TextureLoader, textureSources);

  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  });

  useFrame(({ pointer }, delta) => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    stage.rotation.x = THREE.MathUtils.damp(stage.rotation.x, pointer.y * 0.045, 4, delta);
    stage.rotation.y = THREE.MathUtils.damp(stage.rotation.y, pointer.x * 0.07, 4, delta);
  });

  return (
    <>
      <color attach="background" args={["#edf2f5"]} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[-5, 8, 8]} intensity={4.2} castShadow />
      <pointLight position={[0, 0, 4]} color="#8ab4ff" intensity={8} distance={14} />
      <gridHelper args={[22, 22, "#a8b8c8", "#d4dde5"]} position={[0, -3.7, -1]} rotation={[0, 0, 0]} />
      <group ref={stageRef}>
        <CoreCube mode={mode} />
        {playbooks.map((playbook, index) => (
          <PlaybookCube
            key={playbook.id}
            playbook={playbook}
            index={index}
            mode={mode}
            texture={textures[index]}
            hovered={hoveredId === playbook.id}
            onHover={(item) => setHoveredId(item?.id ?? null)}
            onOpenPlaybook={onOpenPlaybook}
          />
        ))}
      </group>
    </>
  );
}

export function PlaybookLayoutView({ mode, playbookGroup, onOpenPlaybook }: PlaybookLayoutViewProps) {
  const playbooks = getVisiblePlaybooks(playbookGroup);

  return (
    <main className={`playbook-layout playbook-layout--${mode}`} data-layout-mode={mode}>
      <div className="playbook-layout__backdrop" aria-hidden="true" />
      <div className="playbook-3d-layout__header">
        <strong>{mode === "constellation" ? "USER STORY CONSTELLATION" : mode === "ring" ? "STORY GROUP RING" : "FEATURE × USER STORY"}</strong>
        <span>실제 3D 큐브에 마우스를 올리고 클릭해 이야기를 엽니다</span>
      </div>
      <div className="playbook-3d-layout__canvas" aria-label="tosun 3D 비교 큐브">
        <Canvas
          camera={{ position: [0, 0.15, 15], fov: 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          shadows
          fallback={<div className="playbook-3d-layout__fallback">3D 화면을 불러오는 중입니다.</div>}
        >
          <ComparisonStage mode={mode} playbooks={playbooks} onOpenPlaybook={onOpenPlaybook} />
        </Canvas>
      </div>
    </main>
  );
}
