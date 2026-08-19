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
  private readonly glassOpacity: number;
  private readonly glassIOR: number;
  private readonly glassDispersion: number;
  private readonly glassThickness: number;
  private readonly glassEnvMapIntensity: number;
  private readonly glassSpecularIntensity: number;
  private readonly glassClearcoatRoughness: number;
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
    this.glassEnvMapIntensity = glassEnvMapIntensity;
    this.glassSpecularIntensity = glassSpecularIntensity;
    this.glassClearcoatRoughness = glassClearcoatRoughness;
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

  updateInteractionVisual(strength: number, amount: number) {
    const clampedStrength = THREE.MathUtils.clamp(strength, 0, 1);
    this.glassShell.material.envMapIntensity = THREE.MathUtils.lerp(
      this.glassShell.material.envMapIntensity,
      this.glassEnvMapIntensity * (1 + clampedStrength * 0.14),
      amount,
    );
    this.glassShell.material.specularIntensity = THREE.MathUtils.lerp(
      this.glassShell.material.specularIntensity,
      Math.min(1, this.glassSpecularIntensity + clampedStrength * 0.08),
      amount,
    );
    this.glassShell.material.clearcoatRoughness = THREE.MathUtils.lerp(
      this.glassShell.material.clearcoatRoughness,
      Math.max(0.01, this.glassClearcoatRoughness * (1 - clampedStrength * 0.3)),
      amount,
    );
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
    this.glassShell.material.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
