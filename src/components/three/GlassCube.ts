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
  glassFresnelTint: {
    strength: number;
    emissionStrength: number;
    gradeStrength: number;
    worldScale: number;
    viewShift: number;
    instanceShift: number;
    instanceBlend: number;
    colors: readonly [
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
    ];
  };
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
    thumbnailColor: THREE.ColorRepresentation;
    thumbnailDensity: number;
    thumbnailMaxOpacity: number;
    colors: readonly [
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
    ];
    gradientScale: number;
    gradientStrength: number;
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
    glassFresnelTint,
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
    const glassTintInstanceOffset = THREE.MathUtils.euclideanModulo(
      definition.node.x * 0.754877666 +
        definition.node.y * 0.569840296 +
        definition.node.z * 0.438289,
      1,
    );

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
      shader.uniforms.uGlassTintStrength = { value: glassFresnelTint.strength };
      shader.uniforms.uGlassTintEmissionStrength = {
        value: glassFresnelTint.emissionStrength,
      };
      shader.uniforms.uGlassTintGradeStrength = { value: glassFresnelTint.gradeStrength };
      shader.uniforms.uGlassTintWorldScale = { value: glassFresnelTint.worldScale };
      shader.uniforms.uGlassTintViewShift = { value: glassFresnelTint.viewShift };
      shader.uniforms.uGlassTintInstanceShift = { value: glassFresnelTint.instanceShift };
      shader.uniforms.uGlassTintInstanceBlend = { value: glassFresnelTint.instanceBlend };
      shader.uniforms.uGlassTintInstanceOffset = { value: glassTintInstanceOffset };
      shader.uniforms.uGlassTint0 = { value: new THREE.Color(glassFresnelTint.colors[0]) };
      shader.uniforms.uGlassTint1 = { value: new THREE.Color(glassFresnelTint.colors[1]) };
      shader.uniforms.uGlassTint2 = { value: new THREE.Color(glassFresnelTint.colors[2]) };
      shader.uniforms.uGlassTint3 = { value: new THREE.Color(glassFresnelTint.colors[3]) };
      shader.uniforms.uGlassTint4 = { value: new THREE.Color(glassFresnelTint.colors[4]) };
      shader.uniforms.uGlassTint5 = { value: new THREE.Color(glassFresnelTint.colors[5]) };
      shader.vertexShader = shader.vertexShader
        .replace(
          "varying vec3 vViewPosition;",
          `
            varying vec3 vViewPosition;
            varying vec3 vGlassLocalPosition;
            varying vec3 vGlassLocalNormal;
            varying vec3 vGlassWorldPosition;
          `,
        )
        .replace(
          "void main() {",
          `
            void main() {
              vGlassLocalPosition = position;
              vGlassLocalNormal = normal;
              vGlassWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          `,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "varying vec3 vViewPosition;",
          `
            varying vec3 vViewPosition;
            varying vec3 vGlassLocalPosition;
            varying vec3 vGlassLocalNormal;
            varying vec3 vGlassWorldPosition;
            uniform float uGlassHalfExtent;
            uniform float uGlassCoreRoughness;
            uniform float uGlassEdgeRoughness;
            uniform float uGlassEdgeWidth;
            uniform float uGlassEdgeFalloffPower;
            uniform float uGlassFresnelPower;
            uniform float uGlassTintStrength;
            uniform float uGlassTintEmissionStrength;
            uniform float uGlassTintGradeStrength;
            uniform float uGlassTintWorldScale;
            uniform float uGlassTintViewShift;
            uniform float uGlassTintInstanceShift;
            uniform float uGlassTintInstanceBlend;
            uniform float uGlassTintInstanceOffset;
            uniform vec3 uGlassTint0;
            uniform vec3 uGlassTint1;
            uniform vec3 uGlassTint2;
            uniform vec3 uGlassTint3;
            uniform vec3 uGlassTint4;
            uniform vec3 uGlassTint5;

            vec3 sampleGlassFresnelTint(float phase) {
              float segment = abs(fract(phase * 0.5) * 2.0 - 1.0) * 5.0;
              float blend = smoothstep(0.35, 0.65, fract(segment));
              if (segment < 1.0) return mix(uGlassTint0, uGlassTint1, blend);
              if (segment < 2.0) return mix(uGlassTint1, uGlassTint2, blend);
              if (segment < 3.0) return mix(uGlassTint2, uGlassTint3, blend);
              if (segment < 4.0) return mix(uGlassTint3, uGlassTint4, blend);
              return mix(uGlassTint4, uGlassTint5, blend);
            }

            vec3 gradeGlassFresnelTint(vec3 color, float strength) {
              float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
              vec3 saturated = mix(vec3(luminance), color, 1.28);
              vec3 lifted = pow(max(saturated, vec3(0.0)), vec3(1.12));
              return lifted * strength;
            }

            float gradeGlassFresnelFalloff(float value) {
              float contrasted = smoothstep(0.08, 0.92, clamp(value, 0.0, 1.0));
              return pow(contrasted, 0.82);
            }

            float sampleGlassTintDistribution(
              vec3 worldPosition,
              vec3 localNormal,
              float instanceOffset
            ) {
              float broadFlow = 0.5 + 0.5 * sin(
                dot(worldPosition, vec3(0.11, 0.17, 0.13)) +
                instanceOffset * 6.283185
              );
              float crossFlow = 0.5 + 0.5 * sin(
                dot(worldPosition, vec3(-0.23, 0.09, 0.19)) -
                instanceOffset * 3.883222
              );
              float breakup = smoothstep(0.5, 0.68, broadFlow * 0.72 + crossFlow * 0.28);
              float faceBias = 0.42 + 0.58 * abs(dot(
                normalize(localNormal),
                normalize(vec3(0.37, 0.79, 0.49))
              ));
              return mix(0.05, 1.0, breakup) * faceBias;
            }
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
            vec3 glassViewDirection = normalize(-vViewPosition);
            float glassFresnelTintMask = pow(
              clamp(1.0 - abs(dot(normalize(normal), glassViewDirection)), 0.0, 1.0),
              uGlassFresnelPower
            );
            float glassFresnelTintFalloff = gradeGlassFresnelFalloff(
              glassFresnelTintMask
            );
            glassFresnelTintFalloff *= smoothstep(0.12, 0.9, glassDistanceFalloff);
            glassFresnelTintFalloff *= sampleGlassTintDistribution(
              vGlassWorldPosition,
              vGlassLocalNormal,
              uGlassTintInstanceOffset
            );
            float glassViewTintPhase =
              dot(glassViewDirection, normalize(vec3(0.31, 0.67, 0.47))) *
                uGlassTintViewShift;
            float glassWorldTintPhase =
              dot(vGlassWorldPosition, normalize(vec3(0.72, 0.43, 0.55))) *
                uGlassTintWorldScale +
              glassViewTintPhase;
            float glassInstanceTintPhase =
              uGlassTintInstanceOffset * uGlassTintInstanceShift +
              glassViewTintPhase * 0.35;
            vec3 glassWorldTint = sampleGlassFresnelTint(glassWorldTintPhase);
            vec3 glassInstanceTint = sampleGlassFresnelTint(glassInstanceTintPhase);
            vec3 glassFresnelTint = gradeGlassFresnelTint(
              mix(glassWorldTint, glassInstanceTint, uGlassTintInstanceBlend),
              uGlassTintGradeStrength
            );
            totalEmissiveRadiance +=
              glassFresnelTint * glassFresnelTintFalloff * uGlassTintEmissionStrength;
          `,
        )
        .replace(
          "#include <lights_physical_fragment>",
          `
            #include <lights_physical_fragment>
            material.specularColor = mix(
              material.specularColor,
              min(glassFresnelTint, vec3(1.0)),
              clamp(glassFresnelTintFalloff * uGlassTintStrength, 0.0, 1.0)
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

    const hasThumbnail = Boolean(definition.playbook);
    const scatterMaterial = new THREE.ShaderMaterial({
      name: "MI_GlassScatter",
      uniforms: {
        uColor: {
          value: new THREE.Color(
            hasThumbnail ? glassScatter.thumbnailColor : glassScatter.color,
          ),
        },
        uDensity: {
          value: hasThumbnail ? glassScatter.thumbnailDensity : glassScatter.density,
        },
        uMaxOpacity: {
          value: hasThumbnail ? glassScatter.thumbnailMaxOpacity : glassScatter.maxOpacity,
        },
        uHalfExtent: { value: glassHalfExtent },
        uInstanceOffset: { value: glassTintInstanceOffset },
        uGradientScale: { value: glassScatter.gradientScale },
        uGradientStrength: { value: glassScatter.gradientStrength },
        uTint0: { value: new THREE.Color(glassScatter.colors[0]) },
        uTint1: { value: new THREE.Color(glassScatter.colors[1]) },
        uTint2: { value: new THREE.Color(glassScatter.colors[2]) },
        uTint3: { value: new THREE.Color(glassScatter.colors[3]) },
        uVisibility: { value: 0 },
      },
      vertexShader: `
        varying vec3 vViewPosition;
        varying vec3 vViewNormal;
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = viewPosition.xyz;
          vViewNormal = normalize(normalMatrix * normal);
          vLocalPosition = position;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uDensity;
        uniform float uMaxOpacity;
        uniform float uHalfExtent;
        uniform float uInstanceOffset;
        uniform float uGradientScale;
        uniform float uGradientStrength;
        uniform vec3 uTint0;
        uniform vec3 uTint1;
        uniform vec3 uTint2;
        uniform vec3 uTint3;
        uniform float uVisibility;
        varying vec3 vViewPosition;
        varying vec3 vViewNormal;
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;

        vec3 sampleScatterTint(float phase) {
          float segment = fract(phase) * 4.0;
          float blend = smoothstep(0.12, 0.88, fract(segment));
          if (segment < 1.0) return mix(uTint0, uTint1, blend);
          if (segment < 2.0) return mix(uTint1, uTint2, blend);
          if (segment < 3.0) return mix(uTint2, uTint3, blend);
          return mix(uTint3, uTint0, blend);
        }

        void main() {
          vec3 viewDirection = normalize(-vViewPosition);
          float facing = max(abs(dot(normalize(vViewNormal), viewDirection)), 0.18);
          float pathLength = 1.0 / facing;
          vec3 localPosition = vLocalPosition / max(uHalfExtent, 0.0001);
          float worldPhase = dot(
            vWorldPosition,
            normalize(vec3(0.57, 0.73, 0.38))
          ) * uGradientScale;
          float localPhase = dot(
            localPosition,
            normalize(vec3(0.71, 0.43, 0.55))
          ) * 0.18;
          float phase = worldPhase + localPhase + uInstanceOffset * 0.42;
          float cloudA = 0.5 + 0.5 * sin((phase * 0.67 + localPosition.y * 0.12) * 6.283185);
          float cloudB = 0.5 + 0.5 * sin((phase * 0.41 - localPosition.x * 0.09) * 6.283185);
          float cloud = smoothstep(0.18, 0.82, cloudA * 0.68 + cloudB * 0.32);
          vec3 tint = sampleScatterTint(phase);
          vec3 scatterColor = mix(
            uColor,
            tint,
            uGradientStrength * mix(0.48, 1.0, cloud)
          );
          float density = uDensity * mix(0.82, 1.28, cloud);
          float opacity = min(1.0 - exp(-density * pathLength), uMaxOpacity) * uVisibility;
          gl_FragColor = vec4(scatterColor, opacity);
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
