// @ts-nocheck
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

export type PlaybookLayoutMode = "solar" | "index" | "tunnel" | "timeline" | "orbit";

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
  const washes = isIndex
    ? [
        ["#ffd1e1", 180, 190, 360],
        ["#b8eaff", 820, 200, 420],
        ["#d5c5ff", 280, 820, 440],
        ["#c8f4d8", 820, 820, 380],
        ["#ffe3a9", 520, 510, 300],
      ]
    : [
        ["#ffd1b8", 150, 180, 390],
        ["#b9ddff", 840, 220, 420],
        ["#e0c9ff", 250, 820, 430],
        ["#c6f2dd", 820, 820, 360],
        ["#ffb8d8", 560, 470, 340],
      ];

  context.fillStyle = isIndex ? "#f5f8ff" : "#fff8f2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "multiply";

  washes.forEach(([color, centerX, centerY, radius], washIndex) => {
    const gradient = context.createRadialGradient(centerX, centerY, radius * 0.08, centerX, centerY, radius);
    gradient.addColorStop(0, `${color}cc`);
    gradient.addColorStop(0.52, `${color}72`);
    gradient.addColorStop(1, `${color}00`);
    context.fillStyle = gradient;
    context.globalAlpha = 0.62;

    for (let brush = 0; brush < 8; brush += 1) {
      const angle = (brush / 8) * Math.PI * 2 + washIndex * 0.7;
      const offset = radius * 0.15 * Math.sin(brush * 2.7 + washIndex);
      context.beginPath();
      context.ellipse(
        centerX + Math.cos(angle) * offset,
        centerY + Math.sin(angle) * offset,
        radius * (0.72 + (brush % 3) * 0.08),
        radius * (0.52 + (brush % 2) * 0.11),
        angle * 0.35,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  });

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.13;
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
  const texture = useMemo(
    () => (mode === "index" || mode === "timeline" ? makeWatercolorTexture(mode) : null),
    [mode],
  );

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) {
    return null;
  }

  return (
    <mesh position={[0, 0, -8.5]}>
      <planeGeometry args={[28, 22]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
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
  selected,
  hasSelection,
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
  selected: boolean;
  hasSelection: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const basePosition = useMemo(
    () => cubePosition(playbook, index, mode, visiblePlaybooks),
    [index, mode, playbook, visiblePlaybooks],
  );
  const sideColor = playbook.group === "H" ? "#6d89bd" : "#b88763";
  const lightPalette = mode === "index"
    ? ["#8cc8ff", "#ffb6d2", "#b8efcf", "#ffd28d", "#c9b7ff"]
    : ["#b8a8ff", "#ffc47f", "#91ddff", "#ff9fcf", "#b9efcf"];
  const isIndex = mode === "index";
  const layoutScale = isIndex ? 0.86 : mode === "tunnel" ? 0.74 : 0.9;
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

    const interactionPosition = new THREE.Vector3(basePosition[0], basePosition[1], basePosition[2]);
    const modeFocus = mode !== "timeline" && selected;

    if (modeFocus) {
      if (mode === "solar") {
        interactionPosition.multiplyScalar(0.82);
        interactionPosition.z += 1.2;
      } else if (mode === "index") {
        interactionPosition.y += 0.35;
        interactionPosition.z += 1.35;
      } else if (mode === "tunnel") {
        interactionPosition.z += 3.2;
      } else if (mode === "orbit") {
        interactionPosition.y += 0.55;
        interactionPosition.z += 1.25;
      }
    }

    const targetScale = layoutScale
      * (hovered ? 1.18 : 1)
      * (modeFocus ? 1.16 : 1)
      * (isIndex && hasQuery && !focused ? 0.82 : 1)
      * (hasSelection && !selected && mode !== "timeline" ? 0.76 : 1);
    group.position.lerp(interactionPosition, 1 - Math.pow(0.001, delta));
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
  });

  const opacity = isIndex && hasQuery && !focused
    ? 0.16
    : hasSelection && !selected && mode !== "timeline"
      ? 0.28
      : 1;
  const interactiveDim = hasSelection && !selected && mode !== "timeline";
  const lightStage = isIndex || mode === "timeline";
  const transparent = lightStage || (isIndex && hasQuery) || interactiveDim;
  const surfaceColor = isIndex
    ? lightPalette[index % lightPalette.length]
    : mode === "timeline"
      ? lightPalette[index % lightPalette.length]
      : sideColor;
  const surfaceOpacity = isIndex ? 0.7 * opacity : mode === "timeline" ? 0.86 * opacity : opacity;
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
    emissiveIntensity: selected ? 0.72 : lightStage ? 0.2 : mode === "tunnel" || mode === "solar" || mode === "orbit" ? 0.2 : 0.06,
    roughness: lightStage ? 0.16 : 0.42,
    metalness: lightStage ? 0.22 : 0.35,
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
          <mesh position={[0, -0.78, 0]}>
            <boxGeometry args={[0.05, 0.3, 0.05]} />
            <meshBasicMaterial color={lightPalette[index % lightPalette.length]} transparent opacity={opacity} />
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

    if (mode === "tunnel") {
      return (
        <>
          <mesh rotation={[Math.PI * 0.5, 0, 0]} castShadow={shadowsEnabled} receiveShadow={shadowsEnabled}>
            <capsuleGeometry args={[0.68, 0.8, 8, 18]} />
            <meshStandardMaterial {...material()} roughness={0.28} metalness={0.42} />
          </mesh>
          <mesh position={[0, 0, 1.1]}>
            <circleGeometry args={[0.56, 36]} />
            <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 1.12]}>
            <ringGeometry args={[0.59, 0.66, 36]} />
            <meshBasicMaterial color={sideColor} transparent opacity={0.84 * opacity} />
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
        <meshBasicMaterial color={focused || !hasQuery ? lightPalette[index % lightPalette.length] : "#b4b9c8"} transparent opacity={opacity} />
      </mesh> : null}
      <InfoPanel playbook={playbook} visible={hovered} />
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
        <meshStandardMaterial color="#79a4ff" transparent opacity={0.18} roughness={0.16} metalness={0.55} wireframe />
      </mesh>
      <mesh rotation={[-0.1, 0.5, 0.2]}>
        <boxGeometry args={[2.8, 2.8, 0.035]} />
        <meshBasicMaterial color="#78a6ff" transparent opacity={0.22} wireframe />
      </mesh>
      <pointLight color="#ff8a4c" intensity={16} distance={10} />
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

function StageParticles({ mode }: { mode: PlaybookLayoutMode }) {
  const particlesRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = mode === "orbit" ? 160 : mode === "solar" ? 120 : 0;
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

  useFrame((state, delta) => {
    if (!particlesRef.current) {
      return;
    }

    particlesRef.current.rotation.y += delta * 0.045;
    if (mode === "tunnel") {
      particlesRef.current.position.z = (state.clock.elapsedTime * 0.55) % 4;
    }
  });

  const color = mode === "orbit" ? "#c5a9ff" : "#ffd5a3";
  const size = mode === "orbit" ? 0.065 : 0.06;
  const opacity = 0.68;

  if (mode !== "orbit" && mode !== "solar") {
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

function WormholeEffect() {
  const ref = useRef<THREE.Group>(null);
  const spiralCurves = useMemo(() => [
    { color: "#ff4f9a", opacity: 0.78, points: 58 },
    { color: "#8b5cff", opacity: 0.64, points: 58 },
    { color: "#28d7ff", opacity: 0.54, points: 58 },
  ].map(({ color, opacity, points }, spiralIndex) => ({
    color,
    opacity,
    curve: new THREE.CatmullRomCurve3(Array.from({ length: points }, (_, pointIndex) => {
      const progress = pointIndex / (points - 1);
      const angle = progress * Math.PI * 5.2 + spiralIndex * 2.1;
      const radius = 0.32 + progress * 4.9;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.58,
        Math.sin(progress * Math.PI * 3 + spiralIndex) * 0.24,
      );
    })),
  })), []);

  useFrame((state, delta) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.z -= delta * 0.16;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.34) * 0.12;
  });

  const rings = [
    { radius: 2.05, tube: 0.09, color: "#ff4f9a", opacity: 0.76 },
    { radius: 3.35, tube: 0.075, color: "#8b5cff", opacity: 0.62 },
    { radius: 4.8, tube: 0.055, color: "#28d7ff", opacity: 0.5 },
    { radius: 6.35, tube: 0.035, color: "#ffb14d", opacity: 0.38 },
  ];

  return (
    <group ref={ref} position={[0, 0, -7.6]}>
      <mesh>
        <sphereGeometry args={[1.5, 32, 20]} />
        <meshBasicMaterial color="#010108" transparent opacity={0.98} />
      </mesh>
      {rings.map((ring, index) => (
        <mesh key={ring.radius} rotation={[index * 0.12, index * -0.16, index * 0.38]}>
          <torusGeometry args={[ring.radius, ring.tube, 12, 128]} />
          <meshBasicMaterial color={ring.color} transparent opacity={ring.opacity} toneMapped={false} />
        </mesh>
      ))}
      {spiralCurves.map((spiral) => (
        <mesh key={spiral.color}>
          <tubeGeometry args={[spiral.curve, 96, 0.075, 8, false]} />
          <meshBasicMaterial color={spiral.color} transparent opacity={spiral.opacity} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[-2.6, 1.4, 1.2]} color="#ff4f9a" intensity={32} distance={13} />
      <pointLight position={[2.8, -0.8, 0.8]} color="#28d7ff" intensity={28} distance={13} />
      <pointLight position={[0, 2.8, 0.4]} color="#ffb14d" intensity={24} distance={11} />
    </group>
  );
}

function StageEffects({ mode }: { mode: PlaybookLayoutMode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current && (mode === "solar" || mode === "orbit")) {
      ref.current.rotation.z += delta * (mode === "solar" ? 0.035 : -0.022);
    }
  });

  return (
    <>
      <StageParticles mode={mode} />
      <WatercolorBackdrop mode={mode} />
      {mode === "tunnel" ? <WormholeEffect /> : null}
      {mode === "solar" ? (
        <group ref={ref} position={[0, 0, -0.8]}>
          {[2.7, 4.65, 6.55].map((radius, index) => (
            <mesh key={radius} rotation={[Math.PI * 0.5, 0, index * 0.18]}>
              <torusGeometry args={[radius, index === 1 ? 0.035 : 0.018, 8, 96]} />
              <meshBasicMaterial color={index % 2 ? "#ffb36b" : "#ff5d36"} transparent opacity={0.3 - index * 0.05} />
            </mesh>
          ))}
        </group>
      ) : null}
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
          <meshBasicMaterial color="#b99cff" transparent opacity={0.34} wireframe />
        </mesh>
        {Array.from({ length: rows + 1 }, (_, row) => ((rows - 1) / 2 - row + 0.5) * 1.75 - 0.2).map((y) => (
          <mesh key={y} position={[0, y, -1.08]}>
          <boxGeometry args={[width, 0.04, 0.04]} />
            <meshBasicMaterial color={Math.abs(Math.round(y * 10)) % 2 ? "#ff9fcf" : "#7fd8ff"} transparent opacity={0.72} />
          </mesh>
        ))}
        <mesh position={[0, -3.85, 0]}>
          <boxGeometry args={[width + 1.2, 0.08, 2.2]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.72} roughness={0.12} metalness={0.14} emissive="#b9c9ff" emissiveIntensity={0.28} />
        </mesh>
      </>
    );
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
            {Array.from({ length: columns }, (_, column) => (
              <mesh key={column} position={[(column - (columns - 1) / 2) * 2.28, 0, 0]}>
                <boxGeometry args={[0.035, 0.28, 0.035]} />
                <meshBasicMaterial color={row % 2 ? "#bd7e54" : "#5279d8"} transparent opacity={0.78} />
              </mesh>
            ))}
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

  if (mode === "tunnel") {
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

  const stageBackground = mode === "solar"
    ? "#050914"
    : mode === "index"
      ? "#f5f8ff"
      : mode === "timeline"
        ? "#fff8f2"
        : mode === "orbit"
          ? "#080612"
          : "#020207";
  const keyLightColor = mode === "solar"
    ? "#b9d8ff"
    : mode === "index"
      ? "#ffffff"
      : mode === "timeline"
        ? "#fff5e7"
        : mode === "orbit"
          ? "#d4c4ff"
          : "#ffb5ee";
  const lightStage = mode === "index" || mode === "timeline";

  return (
    <>
      <color attach="background" args={[stageBackground]} />
      <ambientLight intensity={lightStage ? 1.45 : mode === "tunnel" ? 0.48 : mode === "orbit" ? 0.8 : 0.7} />
      <directionalLight position={[-5, 8, 8]} color={keyLightColor} intensity={mode === "tunnel" ? 2.8 : 3.7} castShadow={shadowsEnabled} />
      <pointLight position={[0, 0, 4]} color={mode === "solar" ? "#6db7ff" : mode === "orbit" ? "#a881ff" : mode === "timeline" ? "#ff9edc" : mode === "index" ? "#8bdcff" : "#ff4f9a"} intensity={mode === "tunnel" ? 7 : lightStage ? 9 : mode === "solar" || mode === "orbit" ? 10 : 7} distance={14} />
      {mode === "index" ? <pointLight position={[-5, 2, 2]} color="#ff9fcf" intensity={8} distance={12} /> : null}
      {mode === "timeline" ? <pointLight position={[5, -2, 1]} color="#9e8cff" intensity={8} distance={12} /> : null}
      <StageEffects mode={mode} />
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
            selected={hoveredId === playbook.id}
            hasSelection={hoveredId !== null}
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
          : "ORBIT RINGS";
  const description = mode === "solar"
    ? "중앙 코어를 중심으로 스토리가 방사됩니다"
    : mode === "index"
      ? "전체를 훑고 검색 결과를 앞으로 당겨 바로 들어갑니다"
      : mode === "tunnel"
        ? "스토리 큐브가 깊이 방향으로 이어지는 탐색 공간입니다"
        : mode === "timeline"
          ? "스토리를 순서와 레일 단위로 빠르게 훑습니다"
          : "그룹과 스토리가 동심 궤도로 분리됩니다";

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
