// @ts-nocheck
import * as THREE from "three";
import type { CubeMapOverviewNode } from "./cubeMapData";
import type { PlaybookItem } from "../../data/playbookCatalog";

export type GlassCubeThumbnail = THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial[]>;

export function createThumbnailMaterial(texture: THREE.Texture) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    side: THREE.FrontSide,
    toneMapped: true,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    dithering: true,
  });
}

export type GlassCubeDefinition = {
  node: CubeMapOverviewNode;
  playbook: PlaybookItem | null;
  basePosition: THREE.Vector3;
  baseColor: THREE.Color;
};

export type GlassCubeRuntimeState = {
  targetPosition: THREE.Vector3;
  targetScale: number;
  entryProgress: number;
  enterStart: number;
  enterDuration: number;
  entryComplete: boolean;
  baseOpacity: number;
  targetOpacity: number;
  targetBaseColor: THREE.Color;
  targetOpacityMapMix: number;
  targetOpacityMaskStrength: number;
  targetEmissiveStrength: number;
  targetFrontViewFadeStrength: number;
  maskOccluder: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
  axisDepthOccluder: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
};

type GlassCubeOptions = {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  definition: GlassCubeDefinition;
  glassColor: THREE.ColorRepresentation;
  glassHalfExtent: number;
  glassRoughness: number;
  glassEdgeRoughness: number;
  glassEdgeWidth: number;
  glassEdgeFalloffPower: number;
  glassFresnelPower: number;
  glassIridescence: number;
  glassIridescenceIOR: number;
  glassIridescenceThicknessRange: readonly [number, number];
  glassIOR: number;
  glassDispersion: number;
  glassTransmission: number;
  glassThickness: number;
  glassOpacity: number;
  glassEnvMapIntensity: number;
  glassSpecularIntensity: number;
  glassClearcoat: number;
  glassClearcoatRoughness: number;
  glassScatter: {
    color: THREE.ColorRepresentation;
    density: number;
    maxOpacity: number;
    scale: number;
  };
  glassAttenuationColor: THREE.ColorRepresentation;
  glassAttenuationDistance: number;
  baseOpacity: number;
  enterStart: number;
  enterDuration: number;
  targetBaseColor: THREE.Color;
  targetOpacityMaskStrength: number;
  targetEmissiveStrength: number;
  targetFrontViewFadeStrength: number;
};

export class GlassCube extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  readonly definition: GlassCubeDefinition;
  readonly state: GlassCubeRuntimeState;
  readonly glassShell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  readonly scatterShell: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glassOpacity: number;
  private readonly glassIOR: number;
  private readonly glassDispersion: number;
  private readonly glassThickness: number;
  private thumbnailCube: GlassCubeThumbnail | null = null;

  constructor({
    geometry,
    material,
    definition,
    glassColor,
    glassHalfExtent,
    glassRoughness,
    glassEdgeRoughness,
    glassEdgeWidth,
    glassEdgeFalloffPower,
    glassFresnelPower,
    glassIridescence,
    glassIridescenceIOR,
    glassIridescenceThicknessRange,
    glassIOR,
    glassDispersion,
    glassTransmission,
    glassThickness,
    glassOpacity,
    glassEnvMapIntensity,
    glassSpecularIntensity,
    glassClearcoat,
    glassClearcoatRoughness,
    glassScatter,
    glassAttenuationColor,
    glassAttenuationDistance,
    baseOpacity,
    enterStart,
    enterDuration,
    targetBaseColor,
    targetOpacityMaskStrength,
    targetEmissiveStrength,
    targetFrontViewFadeStrength,
  }: GlassCubeOptions) {
    super(geometry, material);
    material.colorWrite = false;
    material.depthWrite = false;
    this.definition = definition;
    this.glassOpacity = glassOpacity;
    this.glassIOR = glassIOR;
    this.glassDispersion = glassDispersion;
    this.glassThickness = glassThickness;
    this.userData.key = definition.node.key;
    this.userData.playbook = definition.playbook;
    this.state = {
      targetPosition: definition.basePosition.clone(),
      targetScale: 1,
      entryProgress: 0,
      enterStart,
      enterDuration,
      entryComplete: false,
      baseOpacity,
      targetOpacity: baseOpacity,
      targetBaseColor: targetBaseColor.clone(),
      targetOpacityMapMix: 0,
      targetOpacityMaskStrength,
      targetEmissiveStrength,
      targetFrontViewFadeStrength,
      maskOccluder: null,
      axisDepthOccluder: null,
    };
    this.position.copy(definition.basePosition);
    this.name = "Glass Cube";

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: glassColor,
      roughness: glassRoughness,
      metalness: 0,
      transmission: glassTransmission,
      thickness: this.glassThickness,
      ior: this.glassIOR,
      dispersion: this.glassDispersion,
      transparent: true,
      opacity: 0,
      envMapIntensity: glassEnvMapIntensity,
      depthWrite: false,
      side: THREE.DoubleSide,
      clearcoat: glassClearcoat,
      clearcoatRoughness: glassClearcoatRoughness,
      iridescence: glassIridescence,
      iridescenceIOR: glassIridescenceIOR,
      iridescenceThicknessRange: [...glassIridescenceThicknessRange],
      specularIntensity: glassSpecularIntensity,
      specularColor: new THREE.Color(glassColor),
      attenuationColor: new THREE.Color(glassAttenuationColor),
      attenuationDistance: glassAttenuationDistance,
    });
    glassMaterial.name = "MI_Glass";
    glassMaterial.userData.masterMaterial = "M_GlassCube";
    glassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uGlassHalfExtent = { value: glassHalfExtent };
      shader.uniforms.uGlassCoreRoughness = { value: glassRoughness };
      shader.uniforms.uGlassEdgeRoughness = { value: glassEdgeRoughness };
      shader.uniforms.uGlassEdgeWidth = { value: glassEdgeWidth };
      shader.uniforms.uGlassEdgeFalloffPower = { value: glassEdgeFalloffPower };
      shader.uniforms.uGlassFresnelPower = { value: glassFresnelPower };
      shader.vertexShader = shader.vertexShader
        .replace(
          "varying vec3 vViewPosition;",
          `
            varying vec3 vViewPosition;
            varying vec3 vGlassLocalPosition;
            varying vec3 vGlassLocalNormal;
          `,
        )
        .replace(
          "void main() {",
          `
            void main() {
              vGlassLocalPosition = position;
              vGlassLocalNormal = normal;
          `,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "varying vec3 vViewPosition;",
          `
            varying vec3 vViewPosition;
            varying vec3 vGlassLocalPosition;
            varying vec3 vGlassLocalNormal;
            uniform float uGlassHalfExtent;
            uniform float uGlassCoreRoughness;
            uniform float uGlassEdgeRoughness;
            uniform float uGlassEdgeWidth;
            uniform float uGlassEdgeFalloffPower;
            uniform float uGlassFresnelPower;
          `,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `
            #include <normal_fragment_maps>
            vec3 glassAbsNormal = abs(normalize(vGlassLocalNormal));
            vec2 glassFacePosition;
            if (glassAbsNormal.x >= glassAbsNormal.y && glassAbsNormal.x >= glassAbsNormal.z) {
              glassFacePosition = vGlassLocalPosition.zy;
            } else if (glassAbsNormal.y >= glassAbsNormal.x && glassAbsNormal.y >= glassAbsNormal.z) {
              glassFacePosition = vGlassLocalPosition.xz;
            } else {
              glassFacePosition = vGlassLocalPosition.xy;
            }
            float glassFaceRadius = max(abs(glassFacePosition.x), abs(glassFacePosition.y)) /
              max(uGlassHalfExtent, 0.0001);
            float glassEdgeStart = 1.0 - uGlassEdgeWidth;
            float glassEdgeDistance = clamp(
              (glassFaceRadius - glassEdgeStart) / max(uGlassEdgeWidth, 0.0001),
              0.0,
              1.0
            );
            float glassDistanceFalloff = pow(
              smoothstep(0.0, 1.0, glassEdgeDistance),
              uGlassEdgeFalloffPower
            );
            float glassEdgeBlur = glassDistanceFalloff;
            roughnessFactor = mix(
              uGlassCoreRoughness,
              uGlassEdgeRoughness,
              glassEdgeBlur
            );
          `,
        );
    };
    glassMaterial.customProgramCacheKey = () =>
      `glass-edge-${glassEdgeRoughness}-${glassEdgeWidth}-${glassEdgeFalloffPower}-${glassFresnelPower}`;
    this.glassShell = new THREE.Mesh(geometry, glassMaterial);
    this.glassShell.name = "Glass Shell";
    this.glassShell.frustumCulled = false;
    this.glassShell.renderOrder = 2;
    this.add(this.glassShell);

    const scatterMaterial = new THREE.ShaderMaterial({
      name: "MI_GlassScatter",
      uniforms: {
        uColor: { value: new THREE.Color(glassScatter.color) },
        uDensity: { value: glassScatter.density },
        uMaxOpacity: { value: glassScatter.maxOpacity },
        uVisibility: { value: 0 },
      },
      vertexShader: `
        varying vec3 vViewPosition;
        varying vec3 vViewNormal;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = viewPosition.xyz;
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uDensity;
        uniform float uMaxOpacity;
        uniform float uVisibility;
        varying vec3 vViewPosition;
        varying vec3 vViewNormal;
        void main() {
          vec3 viewDirection = normalize(-vViewPosition);
          float facing = max(abs(dot(normalize(vViewNormal), viewDirection)), 0.18);
          float pathLength = 1.0 / facing;
          float opacity = min(1.0 - exp(-uDensity * pathLength), uMaxOpacity) * uVisibility;
          gl_FragColor = vec4(uColor, opacity);
        }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });
    scatterMaterial.userData.masterMaterial = "M_GlassScatter";
    this.scatterShell = new THREE.Mesh(geometry, scatterMaterial);
    this.scatterShell.name = "Glass Scatter Shell";
    this.scatterShell.frustumCulled = false;
    this.scatterShell.renderOrder = 1.5;
    this.scatterShell.scale.setScalar(glassScatter.scale);
    this.add(this.scatterShell);
  }

  get key() {
    return this.definition.node.key;
  }

  get playbook() {
    return this.definition.playbook;
  }

  get basePosition() {
    return this.definition.basePosition;
  }

  get baseColor() {
    return this.definition.baseColor;
  }

  attachOccluders(
    maskOccluder: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
    axisDepthOccluder: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
  ) {
    this.state.maskOccluder = maskOccluder;
    this.state.axisDepthOccluder = axisDepthOccluder;
  }

  getThumbnailCube() {
    return this.thumbnailCube;
  }

  setThumbnailCube(thumbnailCube: GlassCubeThumbnail) {
    this.removeThumbnailCube();
    this.thumbnailCube = thumbnailCube;
    thumbnailCube.renderOrder = 1;
    this.add(thumbnailCube);
  }

  setThumbnailTexture(texture: THREE.Texture, size: number) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const materials = Array.from(
      { length: 6 },
      () => createThumbnailMaterial(texture),
    );
    const thumbnailCube = new THREE.Mesh(geometry, materials) as GlassCubeThumbnail;
    thumbnailCube.name = "Thumbnail Cube";
    thumbnailCube.frustumCulled = false;
    this.setThumbnailCube(thumbnailCube);
  }

  updateVisualOpacity(targetOpacity: number, amount: number) {
    this.glassShell.material.opacity = THREE.MathUtils.lerp(
      this.glassShell.material.opacity,
      this.glassOpacity * targetOpacity,
      amount,
    );
    this.scatterShell.material.uniforms.uVisibility.value = THREE.MathUtils.lerp(
      this.scatterShell.material.uniforms.uVisibility.value,
      targetOpacity,
      amount,
    );
    this.thumbnailCube?.material.forEach((material) => {
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, amount);
      const brightness = THREE.MathUtils.lerp(
        material.color.r,
        Math.max(targetOpacity, 0.28),
        amount,
      );
      material.color.setScalar(brightness);
    });
  }

  removeThumbnailCube() {
    if (!this.thumbnailCube) {
      return;
    }

    const thumbnailCube = this.thumbnailCube;
    this.remove(thumbnailCube);
    thumbnailCube.geometry.dispose();
    thumbnailCube.material.forEach((material) => material.dispose());
    this.thumbnailCube = null;
  }

  updateGlassUniform(name: string, value: unknown) {
    const uniform = this.material.uniforms[name];
    if (uniform) {
      uniform.value = value;
    }
  }

  updateGlassUniforms(values: Record<string, unknown>) {
    Object.entries(values).forEach(([name, value]) => {
      this.updateGlassUniform(name, value);
    });
  }

  disposeGlassCube() {
    this.removeThumbnailCube();
    this.scatterShell.material.dispose();
    this.glassShell.material.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
