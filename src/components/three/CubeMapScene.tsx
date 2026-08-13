// @ts-nocheck
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  aiChatSortConfig,
  type AiChatSortRequest,
  type AiChatSortStage,
} from "../../data/aiChatSortConfig";
import {
  PLAYBOOK_CATALOG,
  getPlaybookFallbackThumbnailSrc,
  getPlaybookThumbnailSrc,
  getPlaybooksByFilter,
  getPlaybookByCubeKey,
  type PlaybookFilter,
  type PlaybookItem,
} from "../../data/playbookCatalog";
import {
  buildCubeMapOverview,
  CUBE_MAP_STEPS,
  CUBE_MAP_UNIT,
  type CubeMapOverviewNode,
} from "./cubeMapData";
import { cubeSceneTheme } from "./cubeSceneTheme";
import { createCookTorranceMaterial } from "./createCookTorranceMaterial";
import {
  createParallaxInputController,
  ParallaxUnavailableError,
  type ParallaxInputController,
  type ParallaxTrackingStatus,
  type ParallaxUnavailableReason,
  type ParallaxViewInput,
} from "./parallaxTracking";

const SIZE = (CUBE_MAP_STEPS - 1) * CUBE_MAP_UNIT;
const GRAPH_CENTER = new THREE.Vector3(SIZE / 2, SIZE / 2, SIZE / 2);
const GRID_MIN = -CUBE_MAP_UNIT / 2;
const GRID_MAX = SIZE + CUBE_MAP_UNIT / 2;
const GRID_VISIBILITY_VECTOR = new THREE.Vector3();
const SEARCH_DIMMED_OPACITY = 0.1;
const EMPTY_SPACE_CLICK_THRESHOLD = 6;

type VectorTuple = readonly [number, number, number];

type TargetCandidate = {
  mesh: CubeMesh;
  position: THREE.Vector3;
  scale: number;
};

type TargetBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

type SearchHighlightZoomState = {
  startTime: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
};

type CubeMeshUserData = CubeMapOverviewNode & {
  basePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetScale: number;
  entryProgress: number;
  enterStart: number;
  enterDuration: number;
  entryComplete: boolean;
  baseOpacity: number;
  targetOpacity: number;
  baseColor: THREE.Color;
  targetBaseColor: THREE.Color;
  targetOpacityMapMix: number;
  targetOpacityMaskStrength: number;
  targetEmissiveStrength: number;
  targetFrontViewFadeStrength: number;
  maskOccluder: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  axisDepthOccluder: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
};

type CubeMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> & {
  userData: CubeMeshUserData;
};

type StoryThumbnailCubeMode = "preview" | "orbit";

type GridPlane = THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> & {
  userData: {
    visibilityNormal?: THREE.Vector3;
    visibilityPoint?: THREE.Vector3;
  };
};

type GridPlaneOptions = {
  plane: "xy" | "xz" | "yz";
  fixed: number;
  min: number;
  max: number;
  step: number;
  divisions: number;
  color: THREE.ColorRepresentation;
  opacity: number;
  visibilityNormal?: VectorTuple;
  visibilityPoint?: VectorTuple;
  skipPrimaryLines?: number[];
  skipSecondaryLines?: number[];
};

function outCirc(t: number) {
  return Math.sqrt(1 - Math.pow(Math.min(t, 1) - 1, 2));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
}

function lerpValue(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function getTimeAlpha(responseMs: number, dtMs: number) {
  if (!Number.isFinite(responseMs) || responseMs <= 0) {
    return 1;
  }

  return 1 - Math.exp(-Math.max(0, dtMs) / responseMs);
}

function getCubeHalfExtent(scale: number, padding = 0) {
  return (CUBE_MAP_UNIT * scale) / 2 + padding;
}

function clampTargetToBounds(target: THREE.Vector3, scale: number) {
  const halfExtent = getCubeHalfExtent(scale, cubeSceneTheme.hover.boundaryPadding);
  target.x = THREE.MathUtils.clamp(target.x, GRID_MIN + halfExtent, GRID_MAX - halfExtent);
  target.y = THREE.MathUtils.clamp(target.y, GRID_MIN + halfExtent, GRID_MAX - halfExtent);
  target.z = THREE.MathUtils.clamp(target.z, GRID_MIN + halfExtent, GRID_MAX - halfExtent);

  return target;
}

function getTargetBox(target: THREE.Vector3, scale: number): TargetBox {
  const halfExtent = getCubeHalfExtent(scale, cubeSceneTheme.hover.collisionPadding);

  return {
    minX: target.x - halfExtent,
    maxX: target.x + halfExtent,
    minY: target.y - halfExtent,
    maxY: target.y + halfExtent,
    minZ: target.z - halfExtent,
    maxZ: target.z + halfExtent,
  };
}

function boxesOverlap(a: TargetBox, b: TargetBox) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

function hasTargetCollision(candidates: TargetCandidate[]) {
  for (let i = 0; i < candidates.length; i += 1) {
    const boxA = getTargetBox(candidates[i].position, candidates[i].scale);

    for (let j = i + 1; j < candidates.length; j += 1) {
      const boxB = getTargetBox(candidates[j].position, candidates[j].scale);

      if (boxesOverlap(boxA, boxB)) {
        return true;
      }
    }
  }

  return false;
}

function getCubeBaseColor(node: CubeMapOverviewNode, index: number) {
  const { baseColorOverride, palette, paletteMode } = cubeSceneTheme.cube.shader;

  if (baseColorOverride) {
    return baseColorOverride;
  }

  if (paletteMode !== "spatial" || !Array.isArray(palette) || palette.length === 0) {
    return "#ffffff";
  }

  const hash =
    Math.imul(node.x + 1, 73856093) ^
    Math.imul(node.y + 1, 19349663) ^
    Math.imul(node.z + 1, 83492791) ^
    Math.imul(index + 1, 265443576);

  return palette[Math.abs(hash) % palette.length];
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();

    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

function findFirstMesh(object: THREE.Object3D) {
  let result: THREE.Mesh | null = null;

  object.traverse((child) => {
    if (!result && (child as THREE.Mesh).isMesh) {
      result = child as THREE.Mesh;
    }
  });

  return result;
}

function normalizeCubeGeometry(sourceGeometry: THREE.BufferGeometry) {
  const geometry = sourceGeometry;
  geometry.computeBoundingBox();

  const bounds = geometry.boundingBox;

  if (!bounds) {
    return geometry;
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  geometry.translate(-center.x, -center.y, -center.z);

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (Number.isFinite(maxDimension) && maxDimension > 0) {
    const scale = CUBE_MAP_UNIT / maxDimension;

    if (Math.abs(scale - 1) > 0.0001) {
      geometry.scale(scale, scale, scale);
    }
  }

  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

async function loadCubeModelGeometry(src: string) {
  const gltf = await new GLTFLoader().loadAsync(src);
  gltf.scene.updateMatrixWorld(true);

  const sourceMesh = findFirstMesh(gltf.scene);

  if (!sourceMesh?.geometry) {
    throw new Error(`Cube model does not contain a mesh: ${src}`);
  }

  if (!sourceMesh.geometry.getAttribute("uv")) {
    throw new Error(`Cube model is missing UV Channel 1 data: ${src}`);
  }

  sourceMesh.updateWorldMatrix(true, false);
  const geometry = sourceMesh.geometry.clone();
  geometry.applyMatrix4(sourceMesh.matrixWorld);
  disposeObject(gltf.scene);

  return normalizeCubeGeometry(geometry);
}

function configureCubeMaskTexture(texture: THREE.Texture) {
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

async function loadCubeMaskTexture(src: string, loader: THREE.TextureLoader) {
  const texture = await loader.loadAsync(src);

  return configureCubeMaskTexture(texture);
}

function configureStoryThumbnailTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

async function loadStoryThumbnailTextures(srcs: readonly string[], loader: THREE.TextureLoader) {
  const textures = await Promise.all(
    srcs.map(async (src) => {
      try {
        return configureStoryThumbnailTexture(await loader.loadAsync(src));
      } catch (error) {
        console.warn(`Story thumbnail failed to load: ${src}`, error);
        return null;
      }
    }),
  );

  return textures.filter((texture): texture is THREE.Texture => texture !== null);
}

async function loadPlaybookThumbnailTextures(loader: THREE.TextureLoader) {
  const textures = await Promise.all(
    PLAYBOOK_CATALOG.map(async (playbook) => {
      const source = getPlaybookThumbnailSrc(playbook);

      try {
        return configureStoryThumbnailTexture(await loader.loadAsync(source));
      } catch (error) {
        const fallbackSource = getPlaybookFallbackThumbnailSrc(playbook);

        if (!fallbackSource || fallbackSource === source) {
          console.warn(`Playbook thumbnail failed to load: ${source}`, error);
          return null;
        }

        try {
          return configureStoryThumbnailTexture(await loader.loadAsync(fallbackSource));
        } catch (fallbackError) {
          console.warn(`Playbook thumbnail fallback failed to load: ${fallbackSource}`, fallbackError);
          return null;
        }
      }
    }),
  );

  return new Map(
    PLAYBOOK_CATALOG.map((playbook, index) => [playbook.id, textures[index] ?? null]),
  );
}

function shuffleItems<T>(items: readonly T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getGridPoint(
  plane: GridPlaneOptions["plane"],
  primary: number,
  secondary: number,
  fixed: number,
): [number, number, number] {
  if (plane === "xz") {
    return [primary, fixed, secondary];
  }

  if (plane === "yz") {
    return [fixed, primary, secondary];
  }

  return [primary, secondary, fixed];
}

function createGridPlane({
  plane,
  fixed,
  min,
  max,
  step,
  divisions,
  color,
  opacity,
  visibilityNormal,
  visibilityPoint,
  skipPrimaryLines = [],
  skipSecondaryLines = [],
}: GridPlaneOptions) {
  const positions: number[] = [];
  const skippedPrimary = new Set(skipPrimaryLines);
  const skippedSecondary = new Set(skipSecondaryLines);

  const addSegment = (from: [number, number, number], to: [number, number, number]) => {
    positions.push(...from, ...to);
  };

  for (let i = 0; i <= divisions; i += 1) {
    const coord = min + i * step;

    if (!skippedSecondary.has(i)) {
      addSegment(
        getGridPoint(plane, min, coord, fixed),
        getGridPoint(plane, max, coord, fixed),
      );
    }

    if (!skippedPrimary.has(i)) {
      addSegment(
        getGridPoint(plane, coord, min, fixed),
        getGridPoint(plane, coord, max, fixed),
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  });

  const gridPlane = new THREE.LineSegments(geometry, material) as GridPlane;

  if (visibilityNormal && visibilityPoint) {
    gridPlane.userData.visibilityNormal = new THREE.Vector3(...visibilityNormal).normalize();
    gridPlane.userData.visibilityPoint = new THREE.Vector3(...visibilityPoint);
  }

  return gridPlane;
}

function updateGridPlaneVisibility(
  gridPlanes: GridPlane[],
  camera: THREE.Camera,
  epsilon: number,
) {
  gridPlanes.forEach((gridPlane) => {
    const { visibilityNormal, visibilityPoint } = gridPlane.userData;

    if (!visibilityNormal || !visibilityPoint) {
      gridPlane.visible = true;
      return;
    }

    gridPlane.visible =
      GRID_VISIBILITY_VECTOR.subVectors(camera.position, visibilityPoint).dot(visibilityNormal) >
      epsilon;
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height);
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function wrapAxisGuideText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const characters = Array.from(text);
  const lines: string[] = [];
  let currentLine = "";

  characters.forEach((character) => {
    const nextLine = `${currentLine}${character}`;

    if (currentLine && context.measureText(nextLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = character;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function createAxisGuideTextSprite(
  text: string,
  {
    fontSize,
    fontWeight,
    maxCanvasWidth,
    height,
    textColor,
    backgroundColor,
    borderColor,
    fontFamily,
  }: {
    fontSize: number;
    fontWeight: number;
    maxCanvasWidth: number;
    height: number;
    textColor: string;
    backgroundColor: string;
    borderColor: string;
    fontFamily: string;
  },
) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const paddingX = fontSize * 0.72;
  const paddingY = fontSize * 0.42;
  const lineHeight = fontSize * 1.18;
  const measurementCanvas = document.createElement("canvas");
  const measurementContext = measurementCanvas.getContext("2d");

  if (!measurementContext) {
    return new THREE.Sprite();
  }

  measurementContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const maxTextWidth = maxCanvasWidth - paddingX * 2;
  const lines = wrapAxisGuideText(measurementContext, text, maxTextWidth);
  const textWidth = Math.max(...lines.map((line) => measurementContext.measureText(line).width));
  const canvasWidth = Math.ceil(Math.min(maxCanvasWidth, textWidth + paddingX * 2));
  const canvasHeight = Math.ceil(lines.length * lineHeight + paddingY * 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(canvasWidth * pixelRatio);
  canvas.height = Math.ceil(canvasHeight * pixelRatio);

  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.Sprite();
  }

  context.scale(pixelRatio, pixelRatio);
  drawRoundedRect(context, 1, 1, canvasWidth - 2, canvasHeight - 2, canvasHeight / 2);
  context.fillStyle = backgroundColor;
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = borderColor;
  context.stroke();

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.fillStyle = textColor;
  context.textAlign = "center";
  context.textBaseline = "middle";

  lines.forEach((line, index) => {
    const textY = paddingY + lineHeight * index + lineHeight / 2;
    context.fillText(line, canvasWidth / 2, textY);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvasWidth / canvasHeight;
  sprite.scale.set(height * aspect, height, 1);

  return sprite;
}

function createAxisGuideLineSegments(
  segments: THREE.Vector3[],
  color: THREE.ColorRepresentation,
  opacity: number,
) {
  const positions: number[] = [];

  segments.forEach((point) => {
    positions.push(point.x, point.y, point.z);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
  });
  const lineSegments = new THREE.LineSegments(geometry, material);

  return lineSegments;
}

function createAxisGuideArrowHead(
  point: THREE.Vector3,
  direction: THREE.Vector3,
  {
    color,
    opacity,
    radius,
    length,
  }: {
    color: THREE.ColorRepresentation;
    opacity: number;
    radius: number;
    length: number;
  },
) {
  const normalizedDirection = direction.clone().normalize();
  const geometry = new THREE.ConeGeometry(radius, length, 24);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
  });
  const arrowHead = new THREE.Mesh(geometry, material);
  arrowHead.position.copy(point).add(normalizedDirection.multiplyScalar(length * 0.5));
  arrowHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

  return arrowHead;
}

function createAxisGuideGroup() {
  const { axisGuide } = cubeSceneTheme;
  const group = new THREE.Group();
  const axisLength = GRID_MAX - GRID_MIN;
  const origin = new THREE.Vector3(GRID_MIN, GRID_MIN, GRID_MIN);
  const lineSegments: THREE.Vector3[] = [];
  const tickSegments: THREE.Vector3[] = [];
  const indexesGroup = new THREE.Group();
  indexesGroup.name = "axis-indexes";
  const axes = [
    {
      id: "x",
      direction: new THREE.Vector3(1, 0, 0),
      tickDirection: new THREE.Vector3(0, 1, 0),
      labelOffset: new THREE.Vector3(0, -axisGuide.labelOffset, axisGuide.axisPadding * 0.24),
      titleOffset: new THREE.Vector3(axisGuide.titleOffset, 0, 0),
      title: axisGuide.axes.x.title,
      values: axisGuide.axes.x.values,
    },
    {
      id: "y",
      direction: new THREE.Vector3(0, 1, 0),
      tickDirection: new THREE.Vector3(1, 0, 0),
      labelOffset: new THREE.Vector3(-axisGuide.labelOffset * 1.25, 0, axisGuide.axisPadding * 0.24),
      titleOffset: new THREE.Vector3(0, axisGuide.titleOffset, 0),
      title: axisGuide.axes.y.title,
      values: axisGuide.axes.y.values,
    },
    {
      id: "z",
      direction: new THREE.Vector3(0, 0, 1),
      tickDirection: new THREE.Vector3(0, 1, 0),
      labelOffset: new THREE.Vector3(-axisGuide.labelOffset * 0.25, -axisGuide.labelOffset, 0),
      titleOffset: new THREE.Vector3(0, 0, axisGuide.titleOffset),
      title: axisGuide.axes.z.title,
      values: axisGuide.axes.z.values,
    },
  ];

  axes.forEach((axis) => {
    const endPoint = origin.clone().add(axis.direction.clone().multiplyScalar(axisLength));
    lineSegments.push(origin.clone(), endPoint.clone());
    group.add(
      createAxisGuideArrowHead(endPoint, axis.direction, {
        color: axisGuide.lineColor,
        opacity: axisGuide.lineOpacity,
        radius: axisGuide.arrowRadius,
        length: axisGuide.arrowLength,
      }),
    );

    axis.values.forEach((value, index) => {
      const progress = axis.values.length <= 1 ? 0 : index / (axis.values.length - 1);
      const point = origin.clone().add(axis.direction.clone().multiplyScalar(axisLength * progress));
      const tickStart = point
        .clone()
        .add(axis.tickDirection.clone().multiplyScalar(-axisGuide.tickLength * 0.5));
      const tickEnd = point
        .clone()
        .add(axis.tickDirection.clone().multiplyScalar(axisGuide.tickLength * 0.5));
      tickSegments.push(tickStart, tickEnd);

      const label = createAxisGuideTextSprite(value, {
        fontSize: axisGuide.labelFontSize,
        fontWeight: 600,
        maxCanvasWidth: axisGuide.labelMaxCanvasWidth,
        height: axisGuide.labelHeight,
        textColor: axisGuide.labelTextColor,
        backgroundColor: axisGuide.labelBackgroundColor,
        borderColor: axisGuide.labelBorderColor,
        fontFamily: axisGuide.fontFamily,
      });
      label.position.copy(point.clone().add(axis.labelOffset));
      indexesGroup.add(label);
    });

    const title = createAxisGuideTextSprite(axis.title, {
      fontSize: axisGuide.titleFontSize,
      fontWeight: 700,
      maxCanvasWidth: axisGuide.titleMaxCanvasWidth,
      height: axisGuide.titleHeight,
      textColor: axisGuide.titleTextColor,
      backgroundColor: axisGuide.titleBackgroundColor,
      borderColor: axisGuide.labelBorderColor,
      fontFamily: axisGuide.fontFamily,
    });
    title.position.copy(endPoint.add(axis.titleOffset));
    group.add(title);
  });

  group.add(
    createAxisGuideLineSegments(
      lineSegments,
      axisGuide.lineColor,
      axisGuide.lineOpacity,
    ),
  );
  indexesGroup.add(
    createAxisGuideLineSegments(
      tickSegments,
      axisGuide.tickColor,
      axisGuide.tickOpacity,
    ),
  );
  group.add(indexesGroup);

  return group;
}

function disposeAxisGuideGroup(group: THREE.Group) {
  group.traverse((child) => {
    const sprite = child as THREE.Sprite;
    const spriteMaterial = sprite.material as THREE.SpriteMaterial | undefined;

    if (spriteMaterial?.map) {
      spriteMaterial.map.dispose();
    }

    if ((child as THREE.LineSegments).geometry) {
      (child as THREE.LineSegments).geometry.dispose();
    }

    if ((child as THREE.LineSegments).material) {
      disposeMaterial((child as THREE.LineSegments).material);
    }
  });
  group.clear();
}

function createMaskOutlineMaterial(maskTexture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      maskTexture: { value: maskTexture },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      opacity: { value: 0 },
      outlineColor: { value: new THREE.Color(cubeSceneTheme.hoverGlow.outlineColor) },
      glowColor: { value: new THREE.Color(cubeSceneTheme.hoverGlow.glowColor) },
      outlineOpacity: { value: cubeSceneTheme.hoverGlow.outlineOpacity },
      glowOpacity: { value: cubeSceneTheme.hoverGlow.glowOpacity },
      outlineThickness: { value: cubeSceneTheme.hoverGlow.outlineThickness },
      glowRadius: { value: cubeSceneTheme.hoverGlow.glowRadius },
      noiseStrength: { value: cubeSceneTheme.hoverGlow.noiseStrength },
      flowSpeed: { value: cubeSceneTheme.hoverGlow.flowSpeed },
      pulseSpeed: { value: cubeSceneTheme.hoverGlow.pulseSpeed },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D maskTexture;
      uniform vec2 resolution;
      uniform float time;
      uniform float opacity;
      uniform vec3 outlineColor;
      uniform vec3 glowColor;
      uniform float outlineOpacity;
      uniform float glowOpacity;
      uniform float outlineThickness;
      uniform float glowRadius;
      uniform float noiseStrength;
      uniform float flowSpeed;
      uniform float pulseSpeed;

      varying vec2 vUv;

      float readMask(vec2 uv) {
        return texture2D(maskTexture, uv).r;
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n00 = hash(i + vec2(0.0, 0.0));
        float n10 = hash(i + vec2(1.0, 0.0));
        float n01 = hash(i + vec2(0.0, 1.0));
        float n11 = hash(i + vec2(1.0, 1.0));

        return mix(mix(n00, n10, f.x), mix(n01, n11, f.x), f.y);
      }

      void main() {
        vec2 texel = 1.0 / resolution;
        float center = readMask(vUv);
        float thickness = max(outlineThickness, 1.0);

        float edge = 0.0;
        edge = max(edge, abs(readMask(vUv + texel * vec2(thickness, 0.0)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(-thickness, 0.0)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(0.0, thickness)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(0.0, -thickness)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(thickness, thickness)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(-thickness, thickness)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(thickness, -thickness)) - center));
        edge = max(edge, abs(readMask(vUv + texel * vec2(-thickness, -thickness)) - center));
        edge = smoothstep(0.08, 0.42, edge);

        float glow = 0.0;
        float weight = 0.0;
        for (int i = 1; i <= 8; i += 1) {
          float radius = glowRadius * (float(i) / 8.0);
          float falloff = 1.0 - float(i - 1) / 8.0;
          vec2 offset = texel * radius;

          glow += readMask(vUv + vec2(offset.x, 0.0)) * falloff;
          glow += readMask(vUv - vec2(offset.x, 0.0)) * falloff;
          glow += readMask(vUv + vec2(0.0, offset.y)) * falloff;
          glow += readMask(vUv - vec2(0.0, offset.y)) * falloff;
          glow += readMask(vUv + offset * 0.7071) * falloff;
          glow += readMask(vUv - offset * 0.7071) * falloff;
          glow += readMask(vUv + vec2(offset.x, -offset.y) * 0.7071) * falloff;
          glow += readMask(vUv + vec2(-offset.x, offset.y) * 0.7071) * falloff;
          weight += 8.0 * falloff;
        }

        glow = clamp(glow / max(weight, 0.0001), 0.0, 1.0);
        glow *= 1.0 - smoothstep(0.1, 0.85, center);
        glow = smoothstep(0.02, 0.38, glow);

        float flowTime = time * flowSpeed;
        float noise = valueNoise(vUv * resolution * 0.018 + vec2(flowTime * 18.0, flowTime * 9.0));
        float wave = sin((vUv.y * resolution.y * 0.035) + flowTime * 6.0 + noise * 3.14159);
        float pulse = 0.82 + 0.18 * sin(time * pulseSpeed + noise * 4.0);
        float shimmer = mix(noise, wave * 0.5 + 0.5, 0.42);
        float noiseMask = mix(1.0 - noiseStrength, 1.0 + noiseStrength, shimmer) * pulse;

        float outlineAlpha = edge * outlineOpacity;
        float glowAlpha = glow * glowOpacity * noiseMask;
        float alpha = clamp(outlineAlpha + glowAlpha, 0.0, 1.0) * opacity;
        vec3 color = outlineColor * outlineAlpha + glowColor * glowAlpha;
        color /= max(outlineAlpha + glowAlpha, 0.0001);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

type CubeMapSceneProps = {
  chatSortRequest?: AiChatSortRequest | null;
  highlightRequestId?: number;
  clearHighlightRequestId?: number;
  exitOrbitViewRequestId?: number;
  axisIndexesVisible?: boolean;
  sceneActive?: boolean;
  parallaxViewEnabled?: boolean;
  onOrbitViewChange?: (isOrbitView: boolean) => void;
  onParallaxViewUnavailable?: (reason: ParallaxUnavailableReason) => void;
  onOpenPlaybook?: (playbook: PlaybookItem) => void;
  onSceneReady?: () => void;
};

type CubeViewMode = "map" | "orbit";

export default function CubeMapScene({
  chatSortRequest = null,
  highlightRequestId = 0,
  clearHighlightRequestId = 0,
  exitOrbitViewRequestId = 0,
  axisIndexesVisible = false,
  sceneActive = true,
  parallaxViewEnabled = false,
  onOrbitViewChange,
  onParallaxViewUnavailable,
  onOpenPlaybook,
  onSceneReady,
}: CubeMapSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatSortHandlerRef = useRef<((request: AiChatSortRequest | null) => void) | null>(null);
  const searchHighlightHandlerRef = useRef<(() => void) | null>(null);
  const clearHighlightHandlerRef = useRef<(() => void) | null>(null);
  const exitOrbitViewHandlerRef = useRef<(() => void) | null>(null);
  const orbitViewChangeRef = useRef(onOrbitViewChange);
  const parallaxViewUnavailableRef = useRef(onParallaxViewUnavailable);
  const openPlaybookRef = useRef(onOpenPlaybook);
  const sceneReadyRef = useRef(onSceneReady);
  const sceneActiveRef = useRef(sceneActive);
  const parallaxViewEnabledRef = useRef(parallaxViewEnabled);
  const axisIndexesVisibleRef = useRef(axisIndexesVisible);
  const pendingChatSortRequestRef = useRef<AiChatSortRequest | null>(null);
  const pendingHighlightRequestIdRef = useRef(0);
  const pendingClearHighlightRequestIdRef = useRef(0);

  useEffect(() => {
    orbitViewChangeRef.current = onOrbitViewChange;
  }, [onOrbitViewChange]);

  useEffect(() => {
    sceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  useEffect(() => {
    parallaxViewUnavailableRef.current = onParallaxViewUnavailable;
  }, [onParallaxViewUnavailable]);

  useEffect(() => {
    sceneActiveRef.current = sceneActive;
  }, [sceneActive]);

  useEffect(() => {
    axisIndexesVisibleRef.current = axisIndexesVisible;
  }, [axisIndexesVisible]);

  useEffect(() => {
    openPlaybookRef.current = onOpenPlaybook;
  }, [onOpenPlaybook]);

  useEffect(() => {
    parallaxViewEnabledRef.current = parallaxViewEnabled;
  }, [parallaxViewEnabled]);

  useEffect(() => {
    if (chatSortHandlerRef.current) {
      chatSortHandlerRef.current(chatSortRequest);
      return;
    }

    pendingChatSortRequestRef.current = chatSortRequest;
  }, [chatSortRequest]);

  useEffect(() => {
    if (highlightRequestId <= 0) {
      return;
    }

    if (searchHighlightHandlerRef.current) {
      searchHighlightHandlerRef.current();
      return;
    }

    pendingHighlightRequestIdRef.current = highlightRequestId;
  }, [highlightRequestId]);

  useEffect(() => {
    if (clearHighlightRequestId <= 0) {
      return;
    }

    if (clearHighlightHandlerRef.current) {
      clearHighlightHandlerRef.current();
      return;
    }

    pendingClearHighlightRequestIdRef.current = clearHighlightRequestId;
  }, [clearHighlightRequestId]);

  useEffect(() => {
    if (exitOrbitViewRequestId <= 0) {
      return;
    }

    exitOrbitViewHandlerRef.current?.();
  }, [exitOrbitViewRequestId]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    THREE.ColorManagement.enabled = true;

    const overview = buildCubeMapOverview();
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(cubeSceneTheme.background, cubeSceneTheme.fog.density);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(cubeSceneTheme.background, 0);
    renderer.autoClear = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cubeSceneTheme.rendering.toneMappingExposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("data-cube-map-canvas", "true");
    container.appendChild(renderer.domElement);

    const maskRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    maskRenderTarget.texture.minFilter = THREE.NearestFilter;
    maskRenderTarget.texture.magFilter = THREE.NearestFilter;
    maskRenderTarget.texture.generateMipmaps = false;

    if (renderer.capabilities.isWebGL2) {
      maskRenderTarget.samples = 4;
    }

    const maskScene = new THREE.Scene();
    const maskMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: true,
      depthWrite: true,
    });
    const maskOccluderMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      colorWrite: false,
      depthTest: true,
      depthWrite: true,
    });
    const axisDepthOccluderMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      colorWrite: false,
      depthTest: true,
      depthWrite: true,
    });
    const overlayScene = new THREE.Scene();
    const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const overlayGeometry = new THREE.PlaneGeometry(2, 2);
    const outlineMaterial = createMaskOutlineMaterial(maskRenderTarget.texture);
    const overlayQuad = new THREE.Mesh(overlayGeometry, outlineMaterial);
    overlayQuad.frustumCulled = false;
    overlayScene.add(overlayQuad);

    const camera = new THREE.PerspectiveCamera(
      cubeSceneTheme.camera.fov,
      1,
      cubeSceneTheme.camera.near,
      cubeSceneTheme.camera.far,
    );
    const cameraOffset = new THREE.Vector3(...cubeSceneTheme.camera.offset).sub(GRAPH_CENTER);
    camera.position
      .copy(GRAPH_CENTER)
      .add(cameraOffset.normalize().multiplyScalar(cubeSceneTheme.camera.distance));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = cubeSceneTheme.controls.dampingFactor;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = cubeSceneTheme.camera.minDistance;
    controls.maxDistance = cubeSceneTheme.camera.maxDistance;
    controls.panSpeed = cubeSceneTheme.controls.panSpeed;
    controls.rotateSpeed = cubeSceneTheme.controls.rotateSpeed;
    controls.zoomSpeed = cubeSceneTheme.controls.zoomSpeed;
    controls.target.copy(GRAPH_CENTER);
    controls.update();

    scene.add(
      new THREE.AmbientLight(
        cubeSceneTheme.lights.ambient.color,
        cubeSceneTheme.lights.ambient.intensity,
      ),
    );
    cubeSceneTheme.lights.directional.forEach(({ color, position, intensity }) => {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(...position);
      scene.add(light);
    });

    const gridPlaneOptions = {
      min: GRID_MIN,
      max: GRID_MAX,
      step: CUBE_MAP_UNIT,
      divisions: CUBE_MAP_STEPS,
      color: cubeSceneTheme.grid.color,
      opacity: cubeSceneTheme.grid.opacity,
    };
    const gridPlanes = [
      createGridPlane({
        ...gridPlaneOptions,
        plane: "xz",
        fixed: GRID_MIN,
        visibilityNormal: [0, 1, 0],
        visibilityPoint: [GRAPH_CENTER.x, GRID_MIN, GRAPH_CENTER.z],
      }),
      createGridPlane({
        ...gridPlaneOptions,
        plane: "yz",
        fixed: GRID_MIN,
        visibilityNormal: [1, 0, 0],
        visibilityPoint: [GRID_MIN, GRAPH_CENTER.y, GRAPH_CENTER.z],
        skipPrimaryLines: [0],
      }),
      createGridPlane({
        ...gridPlaneOptions,
        plane: "xy",
        fixed: GRID_MIN,
        visibilityNormal: [0, 0, 1],
        visibilityPoint: [GRAPH_CENTER.x, GRAPH_CENTER.y, GRID_MIN],
        skipPrimaryLines: [0],
        skipSecondaryLines: [0],
      }),
    ];
    gridPlanes.forEach((gridPlane) => scene.add(gridPlane));
    const axisGuideScene = new THREE.Scene();
    axisGuideScene.fog = scene.fog;
    const axisDepthScene = new THREE.Scene();
    const axisGuideGroup = createAxisGuideGroup();
    const axisIndexesGroup = axisGuideGroup.getObjectByName("axis-indexes");
    axisIndexesGroup.visible = axisIndexesVisibleRef.current;
    axisGuideScene.add(axisGuideGroup);

    const nodesGroup = new THREE.Group();
    const cubeMeshes: CubeMesh[] = [];
    scene.add(nodesGroup);

    let nodeGeometry: THREE.BufferGeometry | null = null;
    let maskMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
    let opacityMaskTexture: THREE.Texture | null = null;
    let orbitOpacityMaskTexture: THREE.Texture | null = null;
    let emissiveMaskTexture: THREE.Texture | null = null;
    let storyThumbnailTextures: THREE.Texture[] = [];
    let playbookThumbnailTextures = new Map();
    const playbookThumbnailMeshes = new Map();
    let storyThumbnailCube: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial[]> | null = null;
    let storyThumbnailCubeParent: CubeMesh | null = null;
    let storyThumbnailCubeMode: StoryThumbnailCubeMode | null = null;
    let cubeAssetsReady = false;
    let animationFrame = 0;
    let disposed = false;
    const maskOccludersGroup = new THREE.Group();
    maskOccludersGroup.visible = false;
    maskScene.add(maskOccludersGroup);
    const axisDepthOccludersGroup = new THREE.Group();
    axisDepthOccludersGroup.visible = true;
    axisDepthScene.add(axisDepthOccludersGroup);

    const primaryLight = cubeSceneTheme.lights.directional[0];
    const shaderTheme = cubeSceneTheme.cube.shader;
    const mapViewBaseColor = new THREE.Color(cubeSceneTheme.mapView.baseColor);
    const ambientColor = new THREE.Color(cubeSceneTheme.lights.ambient.color).multiplyScalar(
      cubeSceneTheme.lights.ambient.intensity,
    );

    const createCubeMeshes = (
      geometry: THREE.BufferGeometry,
      opacityMask: THREE.Texture,
      orbitOpacityMask: THREE.Texture,
      emissiveMask: THREE.Texture,
    ) => {
      nodeGeometry = geometry;
      opacityMaskTexture = opacityMask;
      orbitOpacityMaskTexture = orbitOpacityMask;
      emissiveMaskTexture = emissiveMask;

      maskMesh = new THREE.Mesh(nodeGeometry, maskMaterial);
      maskMesh.matrixAutoUpdate = false;
      maskMesh.visible = false;
      maskMesh.frustumCulled = false;
      maskScene.add(maskMesh);

      const now = performance.now();

      overview.nodes.forEach((node, index) => {
        const playbook = getPlaybookByCubeKey(node.key);
        const thumbnailTexture = playbook
          ? playbookThumbnailTextures.get(playbook.id) ?? null
          : null;
        const basePosition = new THREE.Vector3(
          node.x * CUBE_MAP_UNIT,
          node.y * CUBE_MAP_UNIT,
          node.z * CUBE_MAP_UNIT,
        );
        const cubeBaseColor = new THREE.Color(getCubeBaseColor(node, index));
        const material = createCookTorranceMaterial({
          baseColor: mapViewBaseColor,
          roughness: shaderTheme.roughness,
          metallic: shaderTheme.metallic,
          lightDirection: primaryLight.position,
          lightColor: primaryLight.color,
          lightIntensity: primaryLight.intensity,
          ambientColor,
          subsurfaceColor: shaderTheme.subsurfaceColor,
          subsurfaceStrength: shaderTheme.subsurfaceStrength,
          wrap: shaderTheme.wrap,
          rimStrength: shaderTheme.rimStrength,
          rimPower: shaderTheme.rimPower,
          transmissionStrength: shaderTheme.transmissionStrength,
          shadowStrength: shaderTheme.shadowStrength,
          shadowSoftness: shaderTheme.shadowSoftness,
          shadowLift: shaderTheme.shadowLift,
          baseSaturation: shaderTheme.baseSaturation,
          edgeSaturation: shaderTheme.edgeSaturation,
          centerWhiteness: shaderTheme.centerWhiteness,
          faceEdgePower: shaderTheme.faceEdgePower,
          cubeHalfExtent: CUBE_MAP_UNIT / 2,
          colorContrast: shaderTheme.colorContrast,
          colorVibrance: shaderTheme.colorVibrance,
          opacityMap: opacityMask,
          orbitOpacityMap: orbitOpacityMask,
          thumbnailMap: thumbnailTexture,
          thumbnailOpacity: playbook ? cubeSceneTheme.cube.playbookThumbnailOpacity : 0,
          opacityMapMix: 0,
          opacityMaskStrength: cubeSceneTheme.mapView.opacityMaskStrength,
          emissiveMap: emissiveMask,
          emissiveColor: shaderTheme.emissiveColor,
          emissiveStrength: cubeSceneTheme.mapView.emissiveStrength,
          frontViewFadeStrength: 0,
          frontViewFadePower: cubeSceneTheme.orbitView.frontViewFade.power,
          frontViewAlphaMultiplier: cubeSceneTheme.orbitView.frontViewFade.alphaMultiplier,
          frontViewSaturationMultiplier:
            cubeSceneTheme.orbitView.frontViewFade.saturationMultiplier,
          opacity: cubeSceneTheme.cube.opacity,
        });
        const mesh = new THREE.Mesh(nodeGeometry, material) as CubeMesh;
        mesh.position.copy(basePosition);
        mesh.scale.setScalar(0);

        const maskOccluder = new THREE.Mesh(nodeGeometry, maskOccluderMaterial);
        maskOccluder.matrixAutoUpdate = false;
        maskOccluder.visible = false;
        maskOccluder.frustumCulled = false;
        maskOccludersGroup.add(maskOccluder);
        const axisDepthOccluder = new THREE.Mesh(nodeGeometry, axisDepthOccluderMaterial);
        axisDepthOccluder.matrixAutoUpdate = false;
        axisDepthOccluder.visible = false;
        axisDepthOccluder.frustumCulled = false;
        axisDepthOccludersGroup.add(axisDepthOccluder);

        mesh.userData = {
          ...node,
          playbook,
          basePosition,
          targetPosition: basePosition.clone(),
          targetScale: 1,
          entryProgress: 0,
          enterStart:
            now +
            cubeSceneTheme.cube.enterDelay +
            Math.min(index * cubeSceneTheme.cube.enterStagger, cubeSceneTheme.cube.enterMaxStagger),
          enterDuration: cubeSceneTheme.cube.enterDuration,
          entryComplete: false,
          baseOpacity: cubeSceneTheme.cube.opacity,
          targetOpacity: cubeSceneTheme.cube.opacity,
          baseColor: cubeBaseColor,
          targetBaseColor: mapViewBaseColor.clone(),
          targetOpacityMapMix: 0,
          targetOpacityMaskStrength: cubeSceneTheme.mapView.opacityMaskStrength,
          targetEmissiveStrength: cubeSceneTheme.mapView.emissiveStrength,
          targetFrontViewFadeStrength: 0,
          maskOccluder,
          axisDepthOccluder,
        };
        nodesGroup.add(mesh);
        cubeMeshes.push(mesh);
        if (playbook) {
          playbookThumbnailMeshes.set(playbook.id, mesh);
        }
      });

      cubeAssetsReady = true;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-9999, -9999);
    const pointerDownPosition = new THREE.Vector2();
    const spreadDirection = new THREE.Vector3();
    const targetScaleVector = new THREE.Vector3();
    const orbitCameraOffset = new THREE.Vector3();
    const searchZoomTarget = new THREE.Vector3();
    const searchZoomOffset = new THREE.Vector3();
    const parallaxBasePosition = new THREE.Vector3();
    const parallaxBaseQuaternion = new THREE.Quaternion();
    const parallaxOrbitOffset = new THREE.Vector3();
    const parallaxUp = new THREE.Vector3();
    const parallaxForward = new THREE.Vector3();
    const parallaxLookTarget = new THREE.Vector3();
    const parallaxWorldUp = new THREE.Vector3(0, 1, 0);
    const neutralParallaxView: ParallaxViewInput = {
      x: 0,
      y: 0,
      z: 1,
      rawX: 0,
      relativeX: 0,
    };
    let parallaxController: ParallaxInputController | null = null;
    let parallaxTargetView: ParallaxViewInput = { ...neutralParallaxView };
    let parallaxCurrentView: ParallaxViewInput = { ...neutralParallaxView };
    let parallaxBaseFov = camera.fov;
    let parallaxStartToken = 0;
    let parallaxAbortController: AbortController | null = null;
    let lastParallaxRenderAt: number | null = null;
    let isParallaxStarting = false;
    let isParallaxInputFailed = false;
    let isParallaxCameraApplied = false;
    let selectedMesh: CubeMesh | null = null;
    let chatSortCandidateMeshes: CubeMesh[] = [];
    let chatSortStage: AiChatSortStage | null = null;
    let chatSortFilter: PlaybookFilter | null = null;
    let chatSortFinalMesh: CubeMesh | null = null;
    let lastChatSortRequestId = 0;
    let hovered: CubeMesh | null = null;
    let outlineSource: CubeMesh | null = null;
    let outlineSources: CubeMesh[] = [];
    let outlineOpacity = 0;
    let isPointerInside = false;
    let hasPointerDown = false;
    let didPointerDownOnFocusedMesh = false;
    let viewMode: CubeViewMode = "map";
    let focusedMesh: CubeMesh | null = null;
    let savedMapCameraState: {
      position: THREE.Vector3;
      target: THREE.Vector3;
      minDistance: number;
      maxDistance: number;
      enablePan: boolean;
    } | null = null;
    let searchHighlightZoom: SearchHighlightZoomState | null = null;
    let searchHighlightZoomBaseline: {
      position: THREE.Vector3;
      target: THREE.Vector3;
    } | null = null;
    let orbitAutoRotateResumeAt: number | null = null;
    let isOrbitControlsInteractionActive = false;
    container.dataset.cubeViewMode = "map";

    const isSearchHighlightActive = () => Boolean(selectedMesh && viewMode === "map");

    const isChatSortActive = () => chatSortStage !== null && chatSortCandidateMeshes.length > 0;

    const isChatSortFinalStage = () =>
      isChatSortActive() && chatSortStage === 3 && chatSortFinalMesh !== null;

    const setOutlineSource = (source: CubeMesh | null) => {
      outlineSource = source;
      outlineSources = source ? [source] : [];
    };

    const setOutlineSources = (sources: CubeMesh[]) => {
      outlineSources = sources;
      outlineSource = sources[0] ?? null;
    };

    const getCubeMeshByKey = (key: string) =>
      cubeMeshes.find((mesh) => mesh.userData.key === key) ?? null;

    const getInitialChatSortCandidates = () =>
      aiChatSortConfig.initialCandidateCubeKeys
        .map((key) => getCubeMeshByKey(key))
        .filter(Boolean) as CubeMesh[];

    const syncChatSortDataset = () => {
      if (!isChatSortActive()) {
        delete container.dataset.chatSortStage;
        delete container.dataset.chatSortCandidates;
        delete container.dataset.chatSortFinalKey;
        delete container.dataset.chatSortFilter;
        return;
      }

      container.dataset.chatSortStage = String(chatSortStage);
      container.dataset.chatSortCandidates = chatSortCandidateMeshes
        .map((mesh) => mesh.userData.key)
        .join(",");

      if (chatSortFilter) {
        container.dataset.chatSortFilter = chatSortFilter;
      } else {
        delete container.dataset.chatSortFilter;
      }

      if (chatSortFinalMesh) {
        container.dataset.chatSortFinalKey = chatSortFinalMesh.userData.key;
      } else {
        delete container.dataset.chatSortFinalKey;
      }
    };

    const notifyOrbitViewChange = () => {
      orbitViewChangeRef.current?.(viewMode === "orbit");
    };

    const isSceneActive = () => sceneActiveRef.current;

    const isHeadTrackEnabled = () =>
      isSceneActive() && viewMode === "orbit" && parallaxViewEnabledRef.current;

    const stopOrbitAutoRotate = () => {
      orbitAutoRotateResumeAt = null;
      isOrbitControlsInteractionActive = false;
      controls.autoRotate = false;
      delete container.dataset.orbitAutoRotate;
    };

    const startOrbitAutoRotate = () => {
      if (
        viewMode !== "orbit" ||
        !isSceneActive() ||
        !cubeSceneTheme.orbitView.autoRotate.enabled ||
        isHeadTrackEnabled()
      ) {
        stopOrbitAutoRotate();
        return;
      }

      orbitAutoRotateResumeAt = null;
      controls.autoRotateSpeed = cubeSceneTheme.orbitView.autoRotate.speed;
      controls.autoRotate = true;
      container.dataset.orbitAutoRotate = "active";
    };

    const pauseOrbitAutoRotate = () => {
      if (
        viewMode !== "orbit" ||
        !isSceneActive() ||
        !cubeSceneTheme.orbitView.autoRotate.enabled ||
        isHeadTrackEnabled()
      ) {
        stopOrbitAutoRotate();
        return;
      }

      orbitAutoRotateResumeAt = null;
      controls.autoRotate = false;
      container.dataset.orbitAutoRotate = "paused";
    };

    const scheduleOrbitAutoRotateResume = () => {
      if (
        viewMode !== "orbit" ||
        !isSceneActive() ||
        !cubeSceneTheme.orbitView.autoRotate.enabled ||
        isHeadTrackEnabled()
      ) {
        stopOrbitAutoRotate();
        return;
      }

      controls.autoRotate = false;
      orbitAutoRotateResumeAt = performance.now() + cubeSceneTheme.orbitView.autoRotate.resumeDelayMs;
      container.dataset.orbitAutoRotate = "paused";
    };

    const updateOrbitAutoRotate = (frameTime: number) => {
      if (!isSceneActive() || isHeadTrackEnabled()) {
        stopOrbitAutoRotate();
        return;
      }

      if (viewMode !== "orbit" || orbitAutoRotateResumeAt === null) {
        return;
      }

      if (frameTime >= orbitAutoRotateResumeAt) {
        startOrbitAutoRotate();
      }
    };

    const setParallaxTargetView = (view: ParallaxViewInput) => {
      parallaxTargetView = view;
    };

    const formatParallaxInput = (view: ParallaxViewInput) => {
      const formatted = {
        x: Number(view.x.toFixed(3)),
        y: Number(view.y.toFixed(3)),
        z: Number(view.z.toFixed(3)),
        rawX: typeof view.rawX === "number" ? Number(view.rawX.toFixed(3)) : undefined,
        relativeX:
          typeof view.relativeX === "number" ? Number(view.relativeX.toFixed(3)) : undefined,
      };

      return JSON.stringify(formatted);
    };

    const formatParallaxAppliedInput = (view: ParallaxViewInput, yaw: number) =>
      JSON.stringify({
        rawX: Number(((view.rawX ?? view.x) || 0).toFixed(3)),
        relativeX: Number(((view.relativeX ?? view.x) || 0).toFixed(3)),
        x: Number(view.x.toFixed(3)),
        y: Number(view.y.toFixed(3)),
        z: Number(view.z.toFixed(3)),
        yaw: Number(yaw.toFixed(3)),
      });

    const setParallaxStatus = (status: ParallaxTrackingStatus) => {
      container.dataset.parallaxFaceDetected =
        status.faceDetected === null ? "n/a" : String(status.faceDetected);
      container.dataset.parallaxInput = formatParallaxInput(status.input);
      if (typeof status.inferenceMs === "number") {
        container.dataset.parallaxInferenceMs = status.inferenceMs.toFixed(1);
      }
      if (typeof status.trackingFps === "number") {
        container.dataset.parallaxTrackingFps = status.trackingFps.toFixed(1);
      }
    };

    const clearParallaxStatus = () => {
      delete container.dataset.parallaxFaceDetected;
      delete container.dataset.parallaxInput;
      delete container.dataset.parallaxApplied;
      delete container.dataset.parallaxInferenceMs;
      delete container.dataset.parallaxTrackingFps;
      delete container.dataset.parallaxRenderDt;
    };

    const resetParallaxView = () => {
      parallaxTargetView = { ...neutralParallaxView };
      parallaxCurrentView = { ...neutralParallaxView };
      lastParallaxRenderAt = null;
    };

    const stopParallaxInput = () => {
      parallaxStartToken += 1;
      isParallaxStarting = false;
      isParallaxInputFailed = false;
      parallaxAbortController?.abort();
      parallaxAbortController = null;
      parallaxController?.stop();
      parallaxController = null;
      resetParallaxView();
      delete container.dataset.parallaxView;
      clearParallaxStatus();
    };

    const startParallaxInput = () => {
      if (parallaxController || isParallaxStarting || isParallaxInputFailed) {
        return;
      }

      stopOrbitAutoRotate();
      isParallaxStarting = true;
      const startToken = ++parallaxStartToken;
      parallaxAbortController = new AbortController();
      container.dataset.parallaxView = "starting";
      container.dataset.parallaxInput = formatParallaxInput(neutralParallaxView);

      createParallaxInputController({
        target: renderer.domElement,
        config: cubeSceneTheme.orbitView.parallax,
        onView: setParallaxTargetView,
        onStatus: setParallaxStatus,
        signal: parallaxAbortController.signal,
      })
        .then((controller) => {
          if (
            disposed ||
            startToken !== parallaxStartToken ||
            viewMode !== "orbit" ||
            !parallaxViewEnabledRef.current
          ) {
            controller.stop();
            return;
          }

          isParallaxStarting = false;
          parallaxController = controller;
          container.dataset.parallaxView = controller.mode;
          stopOrbitAutoRotate();
        })
        .catch((error) => {
          if (startToken !== parallaxStartToken) {
            return;
          }

          isParallaxStarting = false;
          isParallaxInputFailed = true;
          parallaxAbortController = null;
          container.dataset.parallaxView = "failed";
          resetParallaxView();
          clearParallaxStatus();

          if (error instanceof ParallaxUnavailableError) {
            parallaxViewUnavailableRef.current?.(error.reason);
            return;
          }

          console.warn("Failed to start parallax input.", error);
        });
    };

    const syncParallaxInput = () => {
      if (isSceneActive() && viewMode === "orbit" && parallaxViewEnabledRef.current) {
        if (controls.autoRotate || orbitAutoRotateResumeAt !== null) {
          stopOrbitAutoRotate();
        }
        startParallaxInput();
        return;
      }

      if (parallaxController || isParallaxStarting || isParallaxInputFailed) {
        stopParallaxInput();

        if (isSceneActive() && viewMode === "orbit") {
          startOrbitAutoRotate();
        }
      }
    };

    const updateParallaxView = (frameTime: number) => {
      const renderDt = lastParallaxRenderAt === null ? 1000 / 60 : frameTime - lastParallaxRenderAt;
      lastParallaxRenderAt = frameTime;
      if (viewMode === "orbit" && parallaxViewEnabledRef.current) {
        container.dataset.parallaxRenderDt = renderDt.toFixed(1);
      }

      const isReturningToNeutral =
        Math.abs(parallaxTargetView.x) < 0.0001 &&
        Math.abs(parallaxTargetView.y) < 0.0001 &&
        Math.abs(parallaxTargetView.z - 1) < 0.0001;
      const responseMs = isReturningToNeutral
        ? cubeSceneTheme.orbitView.parallax.camera.neutralReturnMs
        : cubeSceneTheme.orbitView.parallax.camera.responseMs;
      const lerpAmount = getTimeAlpha(responseMs, renderDt);

      parallaxCurrentView = {
        x: lerpValue(parallaxCurrentView.x, parallaxTargetView.x, lerpAmount),
        y: lerpValue(parallaxCurrentView.y, parallaxTargetView.y, lerpAmount),
        z: lerpValue(parallaxCurrentView.z, parallaxTargetView.z, lerpAmount),
        rawX: lerpValue(
          parallaxCurrentView.rawX ?? parallaxCurrentView.x,
          parallaxTargetView.rawX ?? parallaxTargetView.x,
          lerpAmount,
        ),
        relativeX: lerpValue(
          parallaxCurrentView.relativeX ?? parallaxCurrentView.x,
          parallaxTargetView.relativeX ?? parallaxTargetView.x,
          lerpAmount,
        ),
      };
    };

    const applyParallaxCamera = () => {
      if (viewMode !== "orbit" || !isSceneActive() || !parallaxViewEnabledRef.current) {
        return;
      }

      const { camera: parallaxCamera } = cubeSceneTheme.orbitView.parallax;
      const headInputScale = parallaxCamera.headInputScale ?? { x: 2, y: 2 };
      const rawX = parallaxCurrentView.rawX ?? parallaxCurrentView.x;
      const relativeX = parallaxCurrentView.relativeX ?? parallaxCurrentView.x;
      const view = {
        rawX,
        relativeX,
        x: relativeX * headInputScale.x * (parallaxCamera.invertX ? -1 : 1),
        y: parallaxCurrentView.y * headInputScale.y * (parallaxCamera.invertY ? -1 : 1),
        z: parallaxCurrentView.z,
      };

      parallaxBasePosition.copy(camera.position);
      parallaxBaseQuaternion.copy(camera.quaternion);
      parallaxBaseFov = camera.fov;

      const yawAngle = view.x * (parallaxCamera.yawScale ?? 0);
      container.dataset.parallaxApplied = formatParallaxAppliedInput(view, yawAngle);

      parallaxUp
        .set(0, 1, 0)
        .applyQuaternion(parallaxBaseQuaternion)
        .applyAxisAngle(parallaxWorldUp, yawAngle)
        .normalize();
      parallaxLookTarget.copy(controls.target);
      parallaxOrbitOffset
        .subVectors(parallaxBasePosition, parallaxLookTarget)
        .applyAxisAngle(parallaxWorldUp, yawAngle);

      camera.position
        .copy(parallaxLookTarget)
        .add(parallaxOrbitOffset)
        .addScaledVector(parallaxUp, view.y * parallaxCamera.positionScale.y);
      parallaxForward.subVectors(parallaxLookTarget, camera.position).normalize();
      camera.position.addScaledVector(
        parallaxForward,
        (1 - view.z) * parallaxCamera.positionScale.z,
      );
      camera.lookAt(parallaxLookTarget);
      camera.fov = parallaxBaseFov / (1 + parallaxCamera.fovScale - parallaxCamera.fovScale * view.z);
      camera.updateProjectionMatrix();
      isParallaxCameraApplied = true;
    };

    const restoreParallaxCamera = () => {
      if (!isParallaxCameraApplied) {
        return;
      }

      camera.position.copy(parallaxBasePosition);
      camera.quaternion.copy(parallaxBaseQuaternion);
      camera.fov = parallaxBaseFov;
      camera.updateProjectionMatrix();
      isParallaxCameraApplied = false;
    };

    const applyMapControls = () => {
      stopOrbitAutoRotate();
      controls.minDistance = cubeSceneTheme.camera.minDistance;
      controls.maxDistance = cubeSceneTheme.camera.maxDistance;
      controls.enablePan = true;
    };

    const applyOrbitControls = () => {
      controls.minDistance = cubeSceneTheme.orbitView.minDistance;
      controls.maxDistance = cubeSceneTheme.orbitView.maxDistance;
      controls.enablePan = false;
      controls.target.copy(GRAPH_CENTER);
      orbitCameraOffset
        .set(...cubeSceneTheme.orbitView.cameraOffset)
        .normalize()
        .multiplyScalar(cubeSceneTheme.orbitView.cameraDistance);
      camera.position.copy(GRAPH_CENTER).add(orbitCameraOffset);
      controls.update();
    };

    const cancelSearchHighlightZoom = (refreshBaseline = false) => {
      searchHighlightZoom = null;

      if (refreshBaseline && viewMode === "map") {
        searchHighlightZoomBaseline = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
      }
    };

    const resetSearchHighlightZoom = () => {
      searchHighlightZoom = null;
      searchHighlightZoomBaseline = null;
    };

    const setMapViewMaterialTargets = (mesh: CubeMesh) => {
      mesh.userData.targetBaseColor.copy(mapViewBaseColor);
      mesh.userData.targetOpacityMaskStrength = cubeSceneTheme.mapView.opacityMaskStrength;
      mesh.userData.targetEmissiveStrength = cubeSceneTheme.mapView.emissiveStrength;
    };

    const setOrbitViewMaterialTargets = (mesh: CubeMesh) => {
      mesh.userData.targetBaseColor.copy(mesh.userData.baseColor);
      mesh.userData.targetOpacityMaskStrength = 1;
      mesh.userData.targetEmissiveStrength = shaderTheme.emissiveStrength;
    };

    const startSearchHighlightZoom = (targetMesh: CubeMesh) => {
      const baseline =
        searchHighlightZoomBaseline ??
        {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
      searchHighlightZoomBaseline = baseline;

      searchZoomTarget
        .copy(baseline.target)
        .lerp(targetMesh.userData.basePosition, cubeSceneTheme.searchHighlightZoom.targetPull);
      searchZoomOffset
        .copy(baseline.position)
        .sub(baseline.target)
        .multiplyScalar(cubeSceneTheme.searchHighlightZoom.distanceMultiplier);

      searchHighlightZoom = {
        startTime: performance.now(),
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition: searchZoomTarget.clone().add(searchZoomOffset),
        toTarget: searchZoomTarget.clone(),
      };
    };

    const updateSearchHighlightZoom = (frameTime: number) => {
      if (!searchHighlightZoom || viewMode !== "map") {
        return;
      }

      const progress =
        (frameTime - searchHighlightZoom.startTime) / cubeSceneTheme.searchHighlightZoom.durationMs;
      const easedProgress = easeOutCubic(progress);

      camera.position.lerpVectors(
        searchHighlightZoom.fromPosition,
        searchHighlightZoom.toPosition,
        easedProgress,
      );
      controls.target.lerpVectors(
        searchHighlightZoom.fromTarget,
        searchHighlightZoom.toTarget,
        easedProgress,
      );

      if (progress >= 1) {
        camera.position.copy(searchHighlightZoom.toPosition);
        controls.target.copy(searchHighlightZoom.toTarget);
        searchHighlightZoom = null;
      }
    };

    const setDefaultCubeTargets = () => {
      cubeMeshes.forEach((mesh) => {
        mesh.userData.targetPosition.copy(mesh.userData.basePosition);
        mesh.userData.targetScale = 1;
        mesh.userData.targetOpacity = mesh.userData.baseOpacity;
        mesh.userData.targetOpacityMapMix = 0;
        setMapViewMaterialTargets(mesh);
        mesh.userData.targetFrontViewFadeStrength = 0;
      });
    };

    const spreadCubesFrom = (anchorMesh: CubeMesh) => {
      const anchorPosition = anchorMesh.userData.basePosition;
      const falloffDistance = CUBE_MAP_UNIT * cubeSceneTheme.hover.spreadFalloffUnits;

      const buildCandidates = (spreadMultiplier: number) =>
        cubeMeshes.map<TargetCandidate>((mesh) => {
          const basePosition = mesh.userData.basePosition;
          const scale =
            mesh === anchorMesh ? cubeSceneTheme.hover.hoverScale : cubeSceneTheme.hover.dimScale;
          const position = basePosition.clone();

          if (mesh !== anchorMesh) {
            spreadDirection.copy(basePosition).sub(anchorPosition);
            const distance = Math.max(spreadDirection.length(), 0.001);
            const influence = THREE.MathUtils.clamp(
              1 - distance / falloffDistance,
              cubeSceneTheme.hover.spreadMinInfluence,
              1,
            );

            position.add(
              spreadDirection
                .normalize()
                .multiplyScalar(cubeSceneTheme.hover.spreadDistance * influence * spreadMultiplier),
            );
          }

          clampTargetToBounds(position, scale);

          return {
            mesh,
            position,
            scale,
          };
        });

      let selectedCandidates = buildCandidates(0);

      for (
        let spreadMultiplier = 1;
        spreadMultiplier >= 0;
        spreadMultiplier -= cubeSceneTheme.hover.collisionStep
      ) {
        const candidates = buildCandidates(Math.max(0, spreadMultiplier));

        if (!hasTargetCollision(candidates)) {
          selectedCandidates = candidates;
          break;
        }
      }

      selectedCandidates.forEach(({ mesh, position, scale }) => {
        mesh.userData.targetPosition.copy(position);
        mesh.userData.targetScale = scale;
        mesh.userData.targetOpacityMapMix = 0;
        setMapViewMaterialTargets(mesh);
        mesh.userData.targetFrontViewFadeStrength = 0;

        if (mesh === anchorMesh) {
          mesh.userData.targetOpacity = cubeSceneTheme.hover.highlightOpacity;
          return;
        }

        mesh.userData.targetOpacity =
          mesh.userData.baseOpacity * cubeSceneTheme.hover.dimOpacityMultiplier;
      });
    };

    const applyHoverHighlightTarget = (targetMesh: CubeMesh | null) => {
      if (!targetMesh) {
        setOutlineSource(null);
        setDefaultCubeTargets();
        return;
      }

      setOutlineSource(targetMesh);
      spreadCubesFrom(targetMesh);
    };

    type HighlightTargetOptions = {
      filterMode?: boolean;
      finalStage?: boolean;
      finalMesh?: CubeMesh | null;
      showOrbitPreview?: boolean;
    };

    const applyHighlightTargets = (
      highlightedMeshes: CubeMesh[],
      {
        filterMode = false,
        finalStage = false,
        finalMesh = null,
        showOrbitPreview = false,
      }: HighlightTargetOptions = {},
    ) => {
      if (highlightedMeshes.length === 0) {
        disposeStoryThumbnailCube("preview");
        setOutlineSource(null);
        setDefaultCubeTargets();
        return;
      }

      const highlightedSet = new Set(highlightedMeshes);
      setOutlineSources(highlightedMeshes);

      if (showOrbitPreview && finalMesh) {
        createStoryThumbnailCube(finalMesh, "preview");
      } else {
        disposeStoryThumbnailCube("preview");
      }

      cubeMeshes.forEach((mesh) => {
        const isCandidate = highlightedSet.has(mesh);
        const isHoveredCandidate = hovered === mesh && isCandidate;
        const isOrbitPreviewMesh = showOrbitPreview && mesh === finalMesh;
        mesh.userData.targetPosition.copy(mesh.userData.basePosition);
        mesh.userData.targetScale =
          isCandidate
            ? isFilterMode && isHoveredCandidate
              ? cubeSceneTheme.hover.filteredHighlightHoverScale
              : isFilterMode || !isFinalStage || isHoveredCandidate
                ? cubeSceneTheme.hover.searchHighlightHoverScale
                : 1
            : 1;
        mesh.userData.targetOpacity = isCandidate
          ? cubeSceneTheme.hover.highlightOpacity
          : SEARCH_DIMMED_OPACITY;
        mesh.userData.targetOpacityMapMix = isOrbitPreviewMesh ? 1 : 0;

        if (isOrbitPreviewMesh) {
          setOrbitViewMaterialTargets(mesh);
          mesh.userData.targetFrontViewFadeStrength =
            cubeSceneTheme.orbitView.frontViewFade.strength;
          return;
        }

        setMapViewMaterialTargets(mesh);
        mesh.userData.targetEmissiveStrength = isCandidate
          ? shaderTheme.emissiveStrength
          : cubeSceneTheme.mapView.emissiveStrength;
        mesh.userData.targetFrontViewFadeStrength = 0;
      });
    };

    const applySearchHighlightTarget = () => {
      applyHighlightTargets(selectedMesh ? [selectedMesh] : [], {
        finalStage: true,
      });
    };

    const applyChatSortHighlightTargets = () => {
      const isActive = isChatSortActive();
      const isFinalStage = isChatSortFinalStage();
      const isFilterMode = chatSortFilter !== null;

      applyHighlightTargets(isActive ? chatSortCandidateMeshes : [], {
        filterMode: isFilterMode,
        finalStage: isFinalStage,
        finalMesh: chatSortFinalMesh,
        showOrbitPreview: !isFilterMode && isFinalStage && chatSortFinalMesh !== null,
      });
    };

    const applyOrbitViewTargets = () => {
      if (!focusedMesh) {
        return;
      }

      setOutlineSource(focusedMesh);
      cubeMeshes.forEach((mesh) => {
        mesh.userData.targetPosition.copy(
          mesh === focusedMesh ? GRAPH_CENTER : mesh.userData.basePosition,
        );
        mesh.userData.targetScale = mesh === focusedMesh ? cubeSceneTheme.orbitView.focusedScale : 0;
        mesh.userData.targetOpacity = mesh === focusedMesh ? cubeSceneTheme.hover.highlightOpacity : 0;
        mesh.userData.targetOpacityMapMix = mesh === focusedMesh ? 1 : 0;
        if (mesh === focusedMesh) {
          setOrbitViewMaterialTargets(mesh);
        } else {
          setMapViewMaterialTargets(mesh);
        }
        mesh.userData.targetFrontViewFadeStrength =
          mesh === focusedMesh ? cubeSceneTheme.orbitView.frontViewFade.strength : 0;
      });
    };

    const disposeStoryThumbnailCube = (mode?: StoryThumbnailCubeMode) => {
      if (!storyThumbnailCube || (mode && storyThumbnailCubeMode !== mode)) {
        return;
      }

      storyThumbnailCube.parent?.remove(storyThumbnailCube);
      storyThumbnailCube.geometry.dispose();
      storyThumbnailCube.material.forEach((material) => material.dispose());
      storyThumbnailCube = null;
      storyThumbnailCubeParent = null;
      storyThumbnailCubeMode = null;
      delete container.dataset.storyThumbnailFaces;
      delete container.dataset.storyThumbnailMode;
      delete container.dataset.storyThumbnailParentKey;
    };

    const createStoryThumbnailCube = (
      parentMesh: CubeMesh | null,
      mode: StoryThumbnailCubeMode,
    ) => {
      if (!parentMesh || storyThumbnailTextures.length === 0) {
        return;
      }

      if (storyThumbnailCube && storyThumbnailCubeParent === parentMesh) {
        storyThumbnailCubeMode = mode;
        container.dataset.storyThumbnailMode = mode;
        return;
      }

      disposeStoryThumbnailCube();

      const shuffledTextures = shuffleItems(storyThumbnailTextures);
      const faceTextures = Array.from(
        { length: 6 },
        (_, index) => shuffledTextures[index % shuffledTextures.length],
      );
      const storyGeometry = new THREE.BoxGeometry(CUBE_MAP_UNIT, CUBE_MAP_UNIT, CUBE_MAP_UNIT);
      const storyMaterials = faceTextures.map(
        (texture) =>
          new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      );

      storyThumbnailCube = new THREE.Mesh(storyGeometry, storyMaterials);
      storyThumbnailCube.name = "Single Cube Orbit View Story Thumbnail Cube";
      storyThumbnailCube.frustumCulled = false;
      storyThumbnailCube.position.set(0, 0, 0);
      storyThumbnailCube.rotation.set(0, 0, 0);
      storyThumbnailCube.scale.setScalar(cubeSceneTheme.orbitView.storyCube.scale);
      storyThumbnailCube.userData.isStoryThumbnailCube = true;
      storyThumbnailCubeParent = parentMesh;
      storyThumbnailCubeMode = mode;
      parentMesh.add(storyThumbnailCube);
      container.dataset.storyThumbnailFaces = faceTextures
        .map((texture) => texture.source?.data?.currentSrc || texture.source?.data?.src || "story-thumbnail")
        .join(",");
      container.dataset.storyThumbnailMode = mode;
      container.dataset.storyThumbnailParentKey = parentMesh.userData.key;
    };

    const enterOrbitView = () => {
      if (!selectedMesh || viewMode === "orbit") {
        return;
      }

      cancelSearchHighlightZoom();
      viewMode = "orbit";
      focusedMesh = selectedMesh;
      hovered = null;
      setOutlineSource(selectedMesh);
      isOrbitControlsInteractionActive = false;
      savedMapCameraState = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        enablePan: controls.enablePan,
      };
      container.dataset.cubeViewMode = "orbit";
      container.dataset.focusedCubeKey = selectedMesh.userData.key;
      container.style.cursor = "grab";
      applyOrbitControls();
      startOrbitAutoRotate();
      applyOrbitViewTargets();
      createStoryThumbnailCube(focusedMesh, "orbit");
      notifyOrbitViewChange();
    };

    const exitOrbitView = () => {
      if (viewMode !== "orbit") {
        return;
      }

      viewMode = "map";
      stopParallaxInput();
      stopOrbitAutoRotate();
      disposeStoryThumbnailCube();
      focusedMesh = null;
      delete container.dataset.focusedCubeKey;
      container.dataset.cubeViewMode = "map";
      container.style.cursor = "default";

      if (savedMapCameraState) {
        camera.position.copy(savedMapCameraState.position);
        controls.target.copy(savedMapCameraState.target);
        controls.minDistance = savedMapCameraState.minDistance;
        controls.maxDistance = savedMapCameraState.maxDistance;
        controls.enablePan = savedMapCameraState.enablePan;
        savedMapCameraState = null;
      } else {
        applyMapControls();
        controls.target.copy(GRAPH_CENTER);
      }

      controls.update();

      if (isChatSortActive()) {
        applyChatSortHighlightTargets();
      } else if (selectedMesh) {
        applySearchHighlightTarget();
      } else {
        setDefaultCubeTargets();
      }

      notifyOrbitViewChange();
    };

    const resetHighlightState = () => {
      exitOrbitView();
      resetSearchHighlightZoom();
      lastChatSortRequestId = 0;
      chatSortCandidateMeshes = [];
      chatSortStage = null;
      chatSortFilter = null;
      chatSortFinalMesh = null;
      syncChatSortDataset();
      selectedMesh = null;
      hovered = null;
      delete container.dataset.searchHighlightKey;
      container.style.cursor = "default";
      setOutlineSource(null);
      disposeStoryThumbnailCube("preview");
      setDefaultCubeTargets();
    };

    const clearSearchHighlight = resetHighlightState;

    const pickChatSortCandidates = (sourceMeshes: CubeMesh[], count: number) => {
      if (sourceMeshes.length <= count) {
        return [...sourceMeshes];
      }

      return shuffleItems(sourceMeshes).slice(0, count);
    };

    const resetChatSortHighlight = resetHighlightState;

    const applyChatSortRequest = (request: AiChatSortRequest | null) => {
      if (!request) {
        resetChatSortHighlight();
        return;
      }

      if (request.requestId === lastChatSortRequestId) {
        return;
      }

      if (!cubeAssetsReady || cubeMeshes.length === 0) {
        pendingChatSortRequestRef.current = request;
        return;
      }

      lastChatSortRequestId = request.requestId;
      exitOrbitView();
      resetSearchHighlightZoom();

      chatSortFilter = request.filter ?? null;

      if (chatSortFilter) {
        chatSortCandidateMeshes = getPlaybooksByFilter(chatSortFilter)
          .map((playbook) =>
            cubeMeshes.find((mesh) => mesh.userData.playbook?.id === playbook.id),
          )
          .filter(Boolean) as CubeMesh[];
        chatSortStage = request.stage;
        chatSortFinalMesh = null;
        selectedMesh = null;
        hovered = null;
        container.style.cursor = "default";
        syncChatSortDataset();
        applyChatSortHighlightTargets();
        return;
      }

      let nextCandidates = getInitialChatSortCandidates();

      if (request.stage === 2) {
        const sourceCandidates =
          chatSortCandidateMeshes.length > 0 ? chatSortCandidateMeshes : nextCandidates;
        nextCandidates = pickChatSortCandidates(sourceCandidates, aiChatSortConfig.secondStageCount);
      }

      if (request.stage === 3) {
        const sourceCandidates =
          chatSortCandidateMeshes.length > 0 ? chatSortCandidateMeshes : nextCandidates;
        nextCandidates = pickChatSortCandidates(sourceCandidates, aiChatSortConfig.finalStageCount);
      }

      if (nextCandidates.length === 0) {
        nextCandidates = pickChatSortCandidates(cubeMeshes, aiChatSortConfig.finalStageCount);
      }

      chatSortCandidateMeshes = nextCandidates;
      chatSortStage = request.stage;
      chatSortFinalMesh = request.stage === 3 ? nextCandidates[0] ?? null : null;
      selectedMesh = chatSortFinalMesh;
      hovered = null;
      container.style.cursor = "default";

      if (selectedMesh) {
        container.dataset.searchHighlightKey = selectedMesh.userData.key;
      } else {
        delete container.dataset.searchHighlightKey;
      }

      syncChatSortDataset();
      applyChatSortHighlightTargets();

      if (selectedMesh) {
        startSearchHighlightZoom(selectedMesh);
      }
    };

    const selectRandomSearchHighlight = () => {
      if (!cubeAssetsReady || cubeMeshes.length === 0) {
        pendingHighlightRequestIdRef.current = Math.max(pendingHighlightRequestIdRef.current, 1);
        return;
      }

      exitOrbitView();
      chatSortCandidateMeshes = [];
      chatSortStage = null;
      chatSortFilter = null;
      chatSortFinalMesh = null;
      syncChatSortDataset();
      const candidates =
        selectedMesh && cubeMeshes.length > 1
          ? cubeMeshes.filter((mesh) => mesh !== selectedMesh)
          : cubeMeshes;
      selectedMesh = candidates[Math.floor(Math.random() * candidates.length)];
      container.dataset.searchHighlightKey = selectedMesh.userData.key;
      hovered = null;
      container.style.cursor = "default";
      applySearchHighlightTarget();
      startSearchHighlightZoom(selectedMesh);
    };

    const loadCubeAssets = async () => {
      const textureLoader = new THREE.TextureLoader();

      try {
        const [
          geometry,
          opacityMask,
          orbitOpacityMask,
          emissiveMask,
          storyTextures,
        ] =
          await Promise.all([
            loadCubeModelGeometry(cubeSceneTheme.cube.model.src),
            loadCubeMaskTexture(cubeSceneTheme.cube.model.opacityMaskSrc, textureLoader),
            loadCubeMaskTexture(cubeSceneTheme.orbitView.opacityMaskSrc, textureLoader),
            loadCubeMaskTexture(cubeSceneTheme.cube.model.emissiveMaskSrc, textureLoader),
            loadStoryThumbnailTextures(
              cubeSceneTheme.orbitView.storyCube.textureSrcs,
              textureLoader,
            ),
          ]);

        if (disposed) {
          geometry.dispose();
          opacityMask.dispose();
          orbitOpacityMask.dispose();
          emissiveMask.dispose();
          storyTextures.forEach((texture) => texture.dispose());
          return;
        }

        storyThumbnailTextures = storyTextures;
        createCubeMeshes(geometry, opacityMask, orbitOpacityMask, emissiveMask);
        sceneReadyRef.current?.();

        void loadPlaybookThumbnailTextures(textureLoader).then((playbookTextures) => {
          if (disposed) {
            new Set(playbookTextures.values()).forEach((texture) => texture?.dispose());
            return;
          }

          playbookThumbnailTextures = playbookTextures;
          playbookThumbnailMeshes.forEach((mesh, playbookId) => {
            const thumbnailTexture = playbookTextures.get(playbookId);
            if (!thumbnailTexture) {
              return;
            }

            mesh.material.uniforms.uThumbnailMap.value = thumbnailTexture;
            mesh.material.uniforms.uUseThumbnailMap.value = 1;
          });
        });

        if (pendingClearHighlightRequestIdRef.current > 0) {
          pendingClearHighlightRequestIdRef.current = 0;
          resetHighlightState();
        } else if (pendingChatSortRequestRef.current) {
          const pendingRequest = pendingChatSortRequestRef.current;
          pendingChatSortRequestRef.current = null;
          applyChatSortRequest(pendingRequest);
        } else if (pendingHighlightRequestIdRef.current > 0) {
          pendingHighlightRequestIdRef.current = 0;
          selectRandomSearchHighlight();
        }
      } catch (error) {
        if (!disposed) {
          console.error("Failed to load cube scene assets.", error);
        }
      }
    };

    chatSortHandlerRef.current = applyChatSortRequest;
    searchHighlightHandlerRef.current = selectRandomSearchHighlight;
    clearHighlightHandlerRef.current = resetHighlightState;
    exitOrbitViewHandlerRef.current = exitOrbitView;
    void loadCubeAssets();

    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      isPointerInside = true;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const getIntersectedCubes = () => {
      raycaster.setFromCamera(pointer, camera);
      return raycaster
        .intersectObjects(cubeMeshes, false)
        .map((intersection) => intersection.object as CubeMesh);
    };

    const getIntersectedCube = () => {
      const intersections = getIntersectedCubes();

      if (isSearchHighlightActive() && selectedMesh && intersections.includes(selectedMesh)) {
        return selectedMesh;
      }

      return intersections[0] ?? null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      hasPointerDown = true;
      pointerDownPosition.set(event.clientX, event.clientY);
      updatePointer(event);
      didPointerDownOnFocusedMesh = viewMode === "orbit" && getIntersectedCube() === focusedMesh;

      if (viewMode === "orbit") {
        container.style.cursor = "grabbing";
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (viewMode === "orbit") {
        const pointerTravel = Math.hypot(
          event.clientX - pointerDownPosition.x,
          event.clientY - pointerDownPosition.y,
        );
        hasPointerDown = false;
        container.style.cursor = "grab";
        updatePointer(event);

        const didClickFocusedMesh =
          didPointerDownOnFocusedMesh &&
          pointerTravel <= EMPTY_SPACE_CLICK_THRESHOLD &&
          focusedMesh &&
          getIntersectedCube() === focusedMesh;

        didPointerDownOnFocusedMesh = false;

        if (didClickFocusedMesh) {
          const playbook = focusedMesh?.userData.playbook ?? null;
          if (playbook) {
            openPlaybookRef.current?.(playbook);
          }
        }

        return;
      }

      if (!hasPointerDown) {
        hasPointerDown = false;
        didPointerDownOnFocusedMesh = false;
        return;
      }

      const pointerTravel = Math.hypot(
        event.clientX - pointerDownPosition.x,
        event.clientY - pointerDownPosition.y,
      );
      hasPointerDown = false;
      didPointerDownOnFocusedMesh = false;

      if (pointerTravel > EMPTY_SPACE_CLICK_THRESHOLD) {
        return;
      }

      updatePointer(event);

      const intersectedCube = getIntersectedCube();

      if (intersectedCube?.userData.playbook) {
        openPlaybookRef.current?.(intersectedCube.userData.playbook);
        return;
      }

      if (!selectedMesh) {
        return;
      }

      if (intersectedCube === selectedMesh) {
        enterOrbitView();
        return;
      }

      if (!intersectedCube) {
        if (isChatSortActive()) {
          applyChatSortHighlightTargets();
          return;
        }

        clearSearchHighlight();
      }
    };

    const handleControlsStart = () => {
      if (viewMode === "orbit") {
        isOrbitControlsInteractionActive = true;
        pauseOrbitAutoRotate();
        return;
      }

      isOrbitControlsInteractionActive = false;

      if (viewMode === "map" && searchHighlightZoom) {
        cancelSearchHighlightZoom(true);
      }
    };

    const handleControlsEnd = () => {
      if (viewMode === "orbit") {
        if (isOrbitControlsInteractionActive) {
          scheduleOrbitAutoRotateResume();
        }

        isOrbitControlsInteractionActive = false;
        return;
      }

      if (viewMode !== "map" || !selectedMesh || searchHighlightZoom) {
        return;
      }

      searchHighlightZoomBaseline = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
    };

    const clearHover = () => {
      isPointerInside = false;
      hovered = null;
      pointer.set(-9999, -9999);
      hasPointerDown = false;
      if (viewMode === "orbit") {
        container.style.cursor = "grab";
        applyOrbitViewTargets();
        return;
      }

      container.style.cursor = "default";
      if (isChatSortActive()) {
        applyChatSortHighlightTargets();
      } else if (selectedMesh) {
        applySearchHighlightTarget();
      } else {
        setDefaultCubeTargets();
      }
    };

    const updateHoveredCube = () => {
      if (viewMode === "orbit" || !isPointerInside) {
        return;
      }

      if (isChatSortActive()) {
        const candidateSet = new Set(chatSortCandidateMeshes);
        const intersectedCube =
          getIntersectedCubes().find((mesh) => candidateSet.has(mesh)) ?? null;
        const nextHovered =
          intersectedCube && candidateSet.has(intersectedCube) ? intersectedCube : null;

        if (nextHovered === hovered) {
          return;
        }

        hovered = nextHovered;
        container.style.cursor =
          isChatSortFinalStage() && hovered === chatSortFinalMesh ? "pointer" : "default";
        applyChatSortHighlightTargets();
        return;
      }

      const intersectedCube = getIntersectedCube();

      const nextHovered = selectedMesh
        ? intersectedCube === selectedMesh
          ? selectedMesh
          : null
        : intersectedCube;

      if (nextHovered === hovered) {
        return;
      }

      hovered = nextHovered;

      if (selectedMesh) {
        container.style.cursor = hovered ? "pointer" : "default";
        applySearchHighlightTarget();
        return;
      }

      if (hovered) {
        setOutlineSource(hovered);
        container.style.cursor = "pointer";
        spreadCubesFrom(hovered);
      } else {
        container.style.cursor = "default";
        setOutlineSource(null);
        applyHoverHighlightTarget(null);
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      const pixelRatio = renderer.getPixelRatio();
      const bufferWidth = Math.max(1, Math.floor(width * pixelRatio));
      const bufferHeight = Math.max(1, Math.floor(height * pixelRatio));
      maskRenderTarget.setSize(bufferWidth, bufferHeight);
      outlineMaterial.uniforms.resolution.value.set(bufferWidth, bufferHeight);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    requestAnimationFrame(resize);

    renderer.domElement.addEventListener("pointermove", updatePointer);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointerleave", clearHover);
    renderer.domElement.addEventListener("pointercancel", clearHover);
    controls.addEventListener("start", handleControlsStart);
    controls.addEventListener("end", handleControlsEnd);

    const render = () => {
      if (disposed) {
        return;
      }

      animationFrame = requestAnimationFrame(render);
      const frameTime = performance.now();
      syncParallaxInput();
      updateSearchHighlightZoom(frameTime);
      updateOrbitAutoRotate(frameTime);
      controls.update();
      updateParallaxView(frameTime);

      if (viewMode === "orbit") {
        gridPlanes.forEach((gridPlane) => {
          gridPlane.visible = false;
        });
        axisGuideGroup.visible = false;
        axisIndexesGroup.visible = false;
        axisDepthOccludersGroup.visible = false;
      } else {
        axisGuideGroup.visible = true;
        axisIndexesGroup.visible = axisIndexesVisibleRef.current;
        axisDepthOccludersGroup.visible = true;
        updateGridPlaneVisibility(
          gridPlanes,
          camera,
          cubeSceneTheme.grid.backfaceHideEpsilon ?? 0,
        );
        updateHoveredCube();
      }

      const sceneTime = frameTime * 0.001;
      cubeMeshes.forEach((mesh) => {
        const elapsed = frameTime - mesh.userData.enterStart;

        if (elapsed < 0) {
          mesh.userData.entryProgress = 0;
        } else if (elapsed < mesh.userData.enterDuration) {
          mesh.userData.entryProgress = outCirc(elapsed / mesh.userData.enterDuration);
        } else {
          mesh.userData.entryProgress = 1;
          mesh.userData.entryComplete = true;
        }

        mesh.position.lerp(mesh.userData.targetPosition, cubeSceneTheme.hover.positionLerp);
        targetScaleVector.setScalar(mesh.userData.targetScale * mesh.userData.entryProgress);
        mesh.scale.lerp(targetScaleVector, cubeSceneTheme.hover.scaleLerp);
        const shouldOccludeAxisGuide = viewMode === "map" && mesh.userData.entryProgress > 0.001;
        mesh.userData.axisDepthOccluder.visible = shouldOccludeAxisGuide;

        if (shouldOccludeAxisGuide) {
          mesh.updateWorldMatrix(true, false);
          mesh.userData.axisDepthOccluder.matrix.copy(mesh.matrixWorld);
          mesh.userData.axisDepthOccluder.matrixWorldNeedsUpdate = true;
          mesh.userData.axisDepthOccluder.updateMatrixWorld(true);
        }

        const { material } = mesh;
        const opacity = lerpValue(
          material.uniforms.uOpacity.value,
          mesh.userData.targetOpacity,
          cubeSceneTheme.hover.materialLerp,
        );
        material.uniforms.uOpacity.value = opacity;
        material.uniforms.uTime.value = sceneTime;
        material.uniforms.uBaseColor.value.lerp(
          mesh.userData.targetBaseColor,
          cubeSceneTheme.hover.materialLerp,
        );

        if (material.uniforms.uOpacityMapMix) {
          material.uniforms.uOpacityMapMix.value = lerpValue(
            material.uniforms.uOpacityMapMix.value,
            mesh.userData.targetOpacityMapMix,
            cubeSceneTheme.orbitView.opacityMaskTransitionLerp,
          );
        }

        if (material.uniforms.uOpacityMaskStrength) {
          material.uniforms.uOpacityMaskStrength.value = lerpValue(
            material.uniforms.uOpacityMaskStrength.value,
            mesh.userData.targetOpacityMaskStrength,
            cubeSceneTheme.orbitView.opacityMaskTransitionLerp,
          );
        }

        if (material.uniforms.uEmissiveStrength) {
          material.uniforms.uEmissiveStrength.value = lerpValue(
            material.uniforms.uEmissiveStrength.value,
            mesh.userData.targetEmissiveStrength,
            cubeSceneTheme.hover.materialLerp,
          );
        }

        if (material.uniforms.uFrontViewFadeStrength) {
          material.uniforms.uFrontViewFadeStrength.value = lerpValue(
            material.uniforms.uFrontViewFadeStrength.value,
            mesh.userData.targetFrontViewFadeStrength,
            cubeSceneTheme.orbitView.frontViewFade.transitionLerp,
          );
        }

        material.opacity = opacity;
      });

      const activeOutlineSources = outlineSources.filter(
        (source, index, sources) => sources.indexOf(source) === index,
      );
      const activeHighlight =
        focusedMesh ?? selectedMesh ?? hovered ?? activeOutlineSources[0] ?? null;
      outlineOpacity = lerpValue(
        outlineOpacity,
        activeHighlight ? 1 : 0,
        cubeSceneTheme.hoverGlow.fadeLerp,
      );
      const shouldRenderOutline = Boolean(activeOutlineSources.length > 0 && outlineOpacity > 0.01);

      const shouldRenderOutlineMesh = Boolean(maskMesh && shouldRenderOutline);

      if (maskMesh) {
        maskMesh.visible = shouldRenderOutlineMesh;
      }

      applyParallaxCamera();
      renderer.setRenderTarget(maskRenderTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);

      if (shouldRenderOutlineMesh && maskMesh) {
        maskMesh.visible = false;
        const shouldUseOutlineOcclusion =
          viewMode === "map" && !isSearchHighlightActive() && !isChatSortActive();

        activeOutlineSources.forEach((currentOutlineSource) => {
          if (shouldUseOutlineOcclusion) {
            maskOccludersGroup.visible = true;
            cubeMeshes.forEach((mesh) => {
              const { maskOccluder } = mesh.userData;
              const shouldOcclude =
                mesh !== currentOutlineSource && mesh.userData.entryProgress > 0.001;
              maskOccluder.visible = shouldOcclude;

              if (shouldOcclude) {
                mesh.updateWorldMatrix(true, false);
                maskOccluder.matrix.copy(mesh.matrixWorld);
                maskOccluder.matrixWorldNeedsUpdate = true;
                maskOccluder.updateMatrixWorld(true);
              }
            });
            renderer.render(maskScene, camera);
          } else {
            maskOccludersGroup.visible = false;
          }

          maskOccludersGroup.visible = false;
          currentOutlineSource.updateWorldMatrix(true, false);
          maskMesh.visible = true;
          maskMesh.matrix.copy(currentOutlineSource.matrixWorld);
          maskMesh.matrixWorldNeedsUpdate = true;
          maskMesh.updateMatrixWorld(true);
          renderer.render(maskScene, camera);
          maskMesh.visible = false;
        });
      } else if (!activeHighlight) {
        maskOccludersGroup.visible = false;
        setOutlineSource(null);
        outlineOpacity = 0;
      }

      renderer.setRenderTarget(null);
      renderer.setClearColor(cubeSceneTheme.background, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      if (axisGuideGroup.visible) {
        renderer.clearDepth();
        renderer.render(axisDepthScene, camera);
        renderer.render(axisGuideScene, camera);
      }

      if (shouldRenderOutlineMesh) {
        outlineMaterial.uniforms.time.value = sceneTime;
        outlineMaterial.uniforms.opacity.value = outlineOpacity;
        renderer.render(overlayScene, overlayCamera);
      }

      restoreParallaxCamera();
    };

    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", updatePointer);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", clearHover);
      renderer.domElement.removeEventListener("pointercancel", clearHover);
      controls.removeEventListener("start", handleControlsStart);
      controls.removeEventListener("end", handleControlsEnd);
      chatSortHandlerRef.current = null;
      searchHighlightHandlerRef.current = null;
      clearHighlightHandlerRef.current = null;
      exitOrbitViewHandlerRef.current = null;
      if (viewMode === "orbit") {
        orbitViewChangeRef.current?.(false);
      }
      stopParallaxInput();
      controls.dispose();
      axisGuideScene.remove(axisGuideGroup);
      axisDepthScene.remove(axisDepthOccludersGroup);
      disposeAxisGuideGroup(axisGuideGroup);
      axisDepthOccludersGroup.clear();
      disposeStoryThumbnailCube();
      disposeObject(scene);
      nodeGeometry?.dispose();
      opacityMaskTexture?.dispose();
      orbitOpacityMaskTexture?.dispose();
      emissiveMaskTexture?.dispose();
      storyThumbnailTextures.forEach((texture) => texture.dispose());
      maskRenderTarget.dispose();
      maskMaterial.dispose();
      maskOccluderMaterial.dispose();
      axisDepthOccluderMaterial.dispose();
      overlayGeometry.dispose();
      outlineMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="cube-scene" data-layer-name="Cube Map 3D Scene" />;
}
