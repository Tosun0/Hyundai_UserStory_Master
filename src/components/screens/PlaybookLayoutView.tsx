// @ts-nocheck
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PlaybookAccessGroup, PlaybookItem } from "../../data/playbookCatalog";
import { PLAYBOOK_CATALOG } from "../../data/playbookCatalog";

export type PlaybookLayoutMode = "solar" | "index" | "prism" | "timeline" | "orbit" | "helix" | "sphere";

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

function getHelixPosition(index: number, playbookCount: number): Vec3 {
  const turns = 2.35;
  const midpoint = Math.floor(playbookCount / 2);
  const angle = (index - midpoint) * (Math.PI * 2 * turns / Math.max(1, playbookCount - 1)) + Math.PI * 0.5;
  const radius = 3.65 + (index % 3) * 0.2;
  const vertical = (index - (playbookCount - 1) / 2) * 1.2;
  return [
    Math.cos(angle) * radius,
    vertical,
    Math.sin(angle) * radius - 0.12,
  ];
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
    return 17.5 + Math.min(14, Math.max(0, rows - 3) * 1.35);
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
let lastCanvasDragAt = 0;

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
    () => (mode === "index" || mode === "timeline" ? makeWatercolorTexture(mode) : null),
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

function PlaybookObject({
  playbook,
  index,
  mode,
  visiblePlaybooks,
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
    () => cubePosition(playbook, index, mode, visiblePlaybooks),
    [index, mode, playbook, visiblePlaybooks],
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
  const layoutScale = isIndex ? 0.86 : isPrism ? 0.88 : isSphere ? 0.58 : 0.9;
  const cardGeometry = useMemo(
    () => isSphere ? makeCurvedCardGeometry(2, 1.12) : makeCurvedCardGeometry(2.5, 1.5),
    [isSphere],
  );
  const baseRotation = useMemo<Vec3>(
    () => isIndex
      ? [0.025 + (index % 2) * 0.018, -0.05 + (index % 3) * 0.025, 0]
      : mode === "timeline"
        ? [0.02, index % 2 ? -0.08 : 0.08, index % 2 ? -0.04 : 0.04]
      : isSphere
        ? [0, -basePosition[0] * 0.015, basePosition[1] * 0.012]
        : isHelix
          ? [0.02, -basePosition[0] * 0.025, basePosition[2] * 0.015]
          : [0.08 + (index % 3) * 0.035, -0.18 + (index % 4) * 0.08, 0],
    [basePosition, index, isHelix, isIndex, isSphere, mode],
  );

  useEffect(() => () => cardGeometry.dispose(), [cardGeometry]);

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
      const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
      const parent = group.parent;
      if (parent) {
        parent.worldToLocal(cameraPosition);
        group.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          cameraPosition.sub(group.position).normalize(),
        );
      }
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
      // Keep the hover cue in a shallow, shared depth band so it never jumps
      // across neighbouring cards or drops out from under the pointer.
      if (mode === "sphere") {
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
        if (performance.now() - lastCanvasDragAt < 180) {
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
      {isIndex ? <mesh position={[0, -0.57, 0.4]}>
        <boxGeometry args={[1.84, 0.055, 0.035]} />
        <meshBasicMaterial color={focused || !hasQuery ? lightPalette[index % lightPalette.length] : "#b4b9c8"} transparent opacity={opacity} />
      </mesh> : null}
      <InfoPanel playbook={playbook} visible={hovered || focusedView} />
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
        if (Math.hypot(deltaX, deltaY) > CARD_DRAG_THRESHOLD) {
          lastCanvasDragAt = performance.now();
        }
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
    let pointerStart: { x: number; y: number } | null = null;
    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > CARD_DRAG_THRESHOLD) {
        lastCanvasDragAt = performance.now();
      }
    };
    const handlePointerUp = () => {
      pointerStart = null;
    };
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = mode !== "helix";
    controls.zoomSpeed = 0.8;
    controls.minDistance = 10;
    controls.maxDistance = 28;
    controls.rotateSpeed = 0.55;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.enabled = mode !== "helix";
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;
    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("pointerup", handlePointerUp);
    gl.domElement.addEventListener("pointercancel", handlePointerUp);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("pointerup", handlePointerUp);
      gl.domElement.removeEventListener("pointercancel", handlePointerUp);
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
      scrollTarget.current = THREE.MathUtils.clamp(scrollTarget.current - event.deltaY * 0.006, -5.5, 5.5);
    };

    gl.domElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", handleWheel);
  }, [enabled, gl]);

  useFrame((_, delta) => {
    if (ref.current) {
      if (focusActive) {
        scrollTarget.current = 0;
      }
      ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, scrollTarget.current, 5, delta);
      ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, scrollTarget.current * 0.24, 4, delta);
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

function ChromaticBloomEffect() {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.z += delta * 0.045;
  });

  const petals = ["#ff6b9d", "#65d6ff", "#ffd166", "#a78bfa", "#7ee7bd", "#ff9f68"];

  return (
    <group ref={ref} position={[0, 0, -1.3]}>
      <mesh>
        <sphereGeometry args={[1.25, 32, 20]} />
        <meshStandardMaterial color="#fff1c7" emissive="#ff7b7b" emissiveIntensity={1.7} roughness={0.2} metalness={0.1} />
      </mesh>
      {[2.1, 3.45, 4.85].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI * 0.5, index * 0.18, index * 0.32]}>
          <torusGeometry args={[radius, index === 1 ? 0.08 : 0.045, 12, 128]} />
          <meshBasicMaterial color={petals[index]} transparent opacity={0.42} toneMapped={false} />
        </mesh>
      ))}
      {petals.map((color, index) => {
        const angle = (index / petals.length) * Math.PI * 2;
        return <mesh key={color} position={[Math.cos(angle) * 2.7, Math.sin(angle) * 2.7, 0.08]} rotation={[0, 0, angle]} scale={[0.72, 1.8, 0.22]}>
          <sphereGeometry args={[0.58, 20, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.62} toneMapped={false} />
        </mesh>
      })}
      <pointLight position={[-2.6, 1.8, 1.4]} color="#ff6b9d" intensity={16} distance={11} />
      <pointLight position={[2.8, -1.5, 1.2]} color="#65d6ff" intensity={15} distance={11} />
      <pointLight position={[0, 2.6, 1]} color="#ffd166" intensity={14} distance={10} />
    </group>
  );
}

function PrismCascadeEffect() {
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

function StageEffects({ mode }: { mode: PlaybookLayoutMode }) {
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
      {mode === "solar" ? <ChromaticBloomEffect /> : null}
      {mode === "prism" ? <PrismCascadeEffect /> : null}
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
            <meshBasicMaterial color={["#ff6b9d", "#65d6ff", "#ffd166", "#a78bfa"][slotIndex % 4]} transparent opacity={0.46} toneMapped={false} />
          </mesh>;
        })}
      </>
    );
  }

  if (mode === "helix") {
    const curves = [0, Math.PI].map((phase) => new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, index) => {
      const progress = index / 95;
      const angle = progress * Math.PI * 2 * 2.35 + phase;
      return new THREE.Vector3(
        Math.cos(angle) * 3.75,
        (progress - 0.5) * 15.5,
        Math.sin(angle) * 3.75 - 0.4,
      );
    })));
    return (
      <>
        <mesh position={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.035, 0.035, 15.8, 12]} />
          <meshBasicMaterial color="#d9ecff" transparent opacity={0.34} toneMapped={false} />
        </mesh>
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedViewIndex, setFocusedViewIndex] = useState<number | null>(null);
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
  }, [mode, playbooks]);

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

  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  });

  const renderItemCount = mode === "sphere"
    ? Math.max(SPHERE_LAYOUT_COUNT, playbooks.length)
    : playbooks.length;
  const renderItems = playbooks.length === 0
    ? []
    : Array.from({ length: renderItemCount }, (_, index) => ({
      playbook: playbooks[index % playbooks.length],
      index,
    }));
  const shadowsEnabled = renderItems.length <= 32;

  const stageBackground = mode === "solar"
    ? "#160b1b"
    : mode === "index"
      ? "#f5f8ff"
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
      {!lightStage && !transparentStage ? <color attach="background" args={[stageBackground]} /> : null}
      <ambientLight intensity={lightStage ? 1.45 : mode === "sphere" ? 1.08 : mode === "prism" ? 0.72 : mode === "helix" ? 0.82 : mode === "orbit" ? 0.8 : 0.7} />
      <directionalLight position={[-5, 8, 8]} color={keyLightColor} intensity={mode === "prism" ? 3.5 : 3.7} castShadow={shadowsEnabled} />
      <pointLight position={[0, 0, 4]} color={mode === "solar" ? "#ff83bd" : mode === "orbit" ? "#a881ff" : mode === "timeline" ? "#ff9edc" : mode === "index" ? "#8bdcff" : mode === "helix" ? "#65d6ff" : mode === "sphere" ? "#ffd5e1" : "#9f87ff"} intensity={lightStage ? 9 : mode === "sphere" ? 6 : mode === "solar" || mode === "orbit" ? 10 : 7} distance={14} />
      {mode === "index" ? <pointLight position={[-5, 2, 2]} color="#ff9fcf" intensity={8} distance={12} /> : null}
      {mode === "timeline" ? <pointLight position={[5, -2, 1]} color="#9e8cff" intensity={8} distance={12} /> : null}
      <StageEffects mode={mode} />
      <HelixMotionGroup enabled={mode === "helix"} focusActive={focusedViewIndex !== null}>
        <mesh
          position={[0, 0, -12]}
          onClick={(event) => {
            event.stopPropagation();
            setFocusedViewIndex(null);
            setHoveredIndex(null);
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <StageGuides mode={mode} playbooks={playbooks} />
        <group ref={sphereGroupRef}>
          <CoreCube mode={mode} />
          {renderItems.map(({ playbook, index }) => (
            <PlaybookObject
              key={`${playbook.id}-${index}`}
              playbook={playbook}
              index={index}
              mode={mode}
              visiblePlaybooks={playbooks}
              shadowsEnabled={shadowsEnabled}
              texture={textures[index % textures.length]}
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
        </group>
      </HelixMotionGroup>
      <OrbitController mode={mode} sphereGroupRef={sphereGroupRef} />
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
    ? "CHROMATIC BLOOM"
    : mode === "index"
      ? "STORY INDEX"
      : mode === "prism"
        ? "PRISM CASCADE"
        : mode === "helix"
          ? "HELIX"
          : mode === "sphere"
            ? "SPHERE"
        : mode === "timeline"
          ? "TIMELINE RAIL"
          : "ORBIT RINGS";
  const description = mode === "solar"
    ? "컬러 코어와 꽃잎형 레이어가 스토리를 펼칩니다"
    : mode === "index"
      ? "전체를 훑고 검색 결과를 앞으로 당겨 바로 들어갑니다"
      : mode === "prism"
        ? "반투명 프리즘 카드가 계단형 캐스케이드로 이어집니다"
        : mode === "helix"
          ? "스크롤로 세로 소용돌이를 오르내리며 플레이북을 만납니다"
          : mode === "sphere"
            ? "구 안에 서서 내부 스플라인을 따라 플레이북을 훑습니다"
        : mode === "timeline"
          ? "스토리를 순서와 레일 단위로 빠르게 훑습니다"
          : "그룹과 스토리가 동심 궤도로 분리됩니다";

  return (
    <main className={`playbook-layout playbook-layout--${mode}`} data-layout-mode={mode}>
      <div className="playbook-layout__backdrop" aria-hidden="true" />
      <div className="playbook-3d-layout__header">
        <strong>{title}</strong>
        <span>{mode === "sphere"
          ? `${allPlaybooks.length} STORIES · INSIDE VIEW · DRAG LOOK · SCROLL ZOOM · CLICK FOCUS`
          : `${description} · ${mode === "index" && normalizedQuery ? `${focusedIds.size}/${allPlaybooks.length}개` : `${allPlaybooks.length}개`} 스토리 · 드래그 회전 / 스크롤 줌 / 첫 클릭 포커스 / 두 번째 클릭 열기`}
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
      <div className="playbook-3d-layout__canvas" aria-label="tosun 3D 비교 스테이지">
        <Canvas
          key={mode}
          camera={{ position: mode === "sphere" ? [0, 0, 0.1] : [0, 0.45, getCameraDistance(mode, playbooks)], fov: mode === "sphere" ? 68 : 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: mode === "sphere" }}
          shadows={playbooks.length <= 24}
          fallback={<div className="playbook-3d-layout__fallback">3D 화면을 불러오는 중입니다.</div>}
          onPointerMissed={() => undefined}
        >
          <ComparisonStage mode={mode} playbooks={playbooks} focusedIds={focusedIds} hasQuery={mode === "index" && Boolean(normalizedQuery)} onOpenPlaybook={onOpenPlaybook} />
        </Canvas>
      </div>
    </main>
  );
}
