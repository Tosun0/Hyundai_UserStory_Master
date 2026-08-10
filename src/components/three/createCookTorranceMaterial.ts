// @ts-nocheck
import * as THREE from "three";

const EPSILON = 0.0001;

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec2 vUv;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vLocalPosition = position;
    vLocalNormal = normal;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform vec3 uBaseColor;
  uniform float uRoughness;
  uniform float uMetallic;
  uniform vec3 uLightDirection;
  uniform vec3 uLightColor;
  uniform float uLightIntensity;
  uniform vec3 uAmbientColor;
  uniform vec3 uSubsurfaceColor;
  uniform float uSubsurfaceStrength;
  uniform float uWrap;
  uniform float uRimStrength;
  uniform float uRimPower;
  uniform float uTransmissionStrength;
  uniform float uShadowStrength;
  uniform float uShadowSoftness;
  uniform float uShadowLift;
  uniform float uBaseSaturation;
  uniform float uEdgeSaturation;
  uniform float uCenterWhiteness;
  uniform float uFaceEdgePower;
  uniform float uCubeHalfExtent;
  uniform float uColorContrast;
  uniform float uColorVibrance;
  uniform float uOpacity;
  uniform sampler2D uOpacityMap;
  uniform float uUseOpacityMap;
  uniform sampler2D uOrbitOpacityMap;
  uniform float uUseOrbitOpacityMap;
  uniform float uOpacityMapMix;
  uniform float uOpacityMaskStrength;
  uniform sampler2D uEmissiveMap;
  uniform float uUseEmissiveMap;
  uniform vec3 uEmissiveColor;
  uniform float uEmissiveStrength;
  uniform float uFrontViewFadeStrength;
  uniform float uFrontViewFadePower;
  uniform float uFrontViewAlphaMultiplier;
  uniform float uFrontViewSaturationMultiplier;
  uniform float uTime;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec2 vUv;

  const float PI = 3.14159265359;
  const float EPSILON = ${EPSILON.toFixed(4)};

  float safeDot(vec3 a, vec3 b) {
    return max(dot(a, b), 0.0);
  }

  vec3 safeNormalize(vec3 value) {
    return value / max(length(value), EPSILON);
  }

  float distributionGGX(vec3 n, vec3 h, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float nDotH = safeDot(n, h);
    float nDotH2 = nDotH * nDotH;
    float denom = (nDotH2 * (a2 - 1.0) + 1.0);
    return a2 / max(PI * denom * denom, EPSILON);
  }

  float geometrySchlickGGX(float nDotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return nDotV / max(nDotV * (1.0 - k) + k, EPSILON);
  }

  float geometrySmith(vec3 n, vec3 v, vec3 l, float roughness) {
    float nDotV = safeDot(n, v);
    float nDotL = safeDot(n, l);
    float ggxV = geometrySchlickGGX(nDotV, roughness);
    float ggxL = geometrySchlickGGX(nDotL, roughness);
    return ggxV * ggxL;
  }

  vec3 fresnelSchlick(float cosTheta, vec3 f0) {
    float safeCosTheta = clamp(cosTheta, 0.0, 1.0);
    return f0 + (1.0 - f0) * pow(1.0 - safeCosTheta, 5.0);
  }

  vec3 saturateColor(vec3 color, float amount) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return max(mix(vec3(luminance), color, amount), vec3(0.0));
  }

  vec3 applyColorContrast(vec3 color, float contrast) {
    return clamp((color - 0.5) * contrast + 0.5, 0.0, 1.0);
  }

  vec3 applyVibrance(vec3 color, float vibrance) {
    float maxChannel = max(max(color.r, color.g), color.b);
    float minChannel = min(min(color.r, color.g), color.b);
    float saturationRange = max(maxChannel - minChannel, 0.0);
    float boost = vibrance * (1.0 - clamp(saturationRange, 0.0, 1.0));
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return clamp(mix(vec3(luminance), color, 1.0 + boost), 0.0, 1.0);
  }

  vec2 getFaceUv(vec3 localPosition, vec3 localNormal) {
    vec3 absNormal = abs(localNormal);

    if (absNormal.x >= absNormal.y && absNormal.x >= absNormal.z) {
      return localPosition.zy / max(uCubeHalfExtent, EPSILON);
    }

    if (absNormal.y >= absNormal.x && absNormal.y >= absNormal.z) {
      return localPosition.xz / max(uCubeHalfExtent, EPSILON);
    }

    return localPosition.xy / max(uCubeHalfExtent, EPSILON);
  }

  float getMaskLuminance(vec4 texel) {
    return dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  }

  float getOpacityMaskSource(vec4 texel) {
    float luminance = getMaskLuminance(texel);
    return texel.a < 0.999 ? texel.a : luminance;
  }

  void main() {
    vec3 paletteColor = max(uBaseColor, vec3(0.0));
    vec2 faceUv = clamp(getFaceUv(vLocalPosition, vLocalNormal), vec2(-1.0), vec2(1.0));
    float faceEdgePower = max(uFaceEdgePower, 0.1);
    float edgeFactor = pow(clamp(max(abs(faceUv.x), abs(faceUv.y)), 0.0, 1.0), faceEdgePower);
    edgeFactor = smoothstep(0.02, 1.0, edgeFactor);

    vec3 baseSaturated = saturateColor(paletteColor, max(uBaseSaturation, 0.0));
    vec3 edgeSaturated = saturateColor(paletteColor, max(uEdgeSaturation, 0.0));
    vec3 milkyWhite = mix(vec3(1.0), baseSaturated, 0.14);
    vec3 centerColor = mix(baseSaturated, milkyWhite, clamp(uCenterWhiteness, 0.0, 1.0));
    vec3 baseColor = mix(centerColor, edgeSaturated, edgeFactor);
    baseColor = applyVibrance(baseColor, max(uColorVibrance, 0.0));
    baseColor = applyColorContrast(baseColor, max(uColorContrast, 0.0));
    float roughness = clamp(uRoughness, 0.04, 1.0);
    float metallic = clamp(uMetallic, 0.0, 1.0);
    float wrap = clamp(uWrap, 0.0, 1.0);
    float subsurfaceStrength = max(uSubsurfaceStrength, 0.0);
    float rimStrength = max(uRimStrength, 0.0);
    float rimPower = max(uRimPower, 0.1);
    float transmissionStrength = max(uTransmissionStrength, 0.0);
    float shadowStrength = clamp(uShadowStrength, 0.0, 1.0);
    float shadowSoftness = max(uShadowSoftness, EPSILON);
    float shadowLift = clamp(uShadowLift, 0.0, 1.0);

    vec3 N = safeNormalize(vWorldNormal);
    vec3 V = safeNormalize(cameraPosition - vWorldPosition);
    vec3 L = safeNormalize(uLightDirection);
    vec3 H = safeNormalize(V + L);

    float NdotL = safeDot(N, L);
    float NdotV = max(safeDot(N, V), EPSILON);
    float rawNdotL = dot(N, L);
    float HdotV = safeDot(H, V);

    vec3 F0 = mix(vec3(0.04), baseColor, metallic);
    vec3 F = fresnelSchlick(HdotV, F0);
    float D = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);

    vec3 numerator = D * G * F;
    float denominator = max(4.0 * NdotV * max(NdotL, EPSILON), EPSILON);
    vec3 specularBRDF = numerator / denominator;

    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);
    vec3 diffuseBRDF = kD * baseColor / PI;

    vec3 direct = (diffuseBRDF + specularBRDF) * uLightColor * uLightIntensity * NdotL;
    vec3 subsurfaceTint = mix(baseColor, uSubsurfaceColor, clamp(subsurfaceStrength * 0.24, 0.0, 1.0));
    float shadowMask = smoothstep(-shadowSoftness, 1.0, rawNdotL);
    float fillShadow = mix(1.0, mix(shadowLift, 1.0, shadowMask), shadowStrength);
    float wrappedNdotL = clamp((rawNdotL + wrap) / max(1.0 + wrap, EPSILON), 0.0, 1.0);
    float rim = pow(clamp(1.0 - NdotV, 0.0, 1.0), rimPower);
    float backScatter = pow(safeDot(V, -L), 2.0) * (0.35 + 0.65 * rim);
    float softScatter = wrappedNdotL * (1.0 - NdotL * 0.65);

    vec3 wrappedDiffuse = subsurfaceTint * softScatter * subsurfaceStrength * 0.42;
    vec3 rimLight = uSubsurfaceColor * rim * rimStrength;
    vec3 transmission = subsurfaceTint * backScatter * transmissionStrength;
    vec3 subsurface = (wrappedDiffuse + rimLight + transmission) * uLightColor * uLightIntensity * fillShadow;
    vec3 ambient =
      uAmbientColor *
      mix(baseColor, subsurfaceTint, clamp(subsurfaceStrength * 0.1, 0.0, 1.0)) *
      fillShadow;
    vec3 color = direct + ambient + subsurface;
    float opacityMask = 1.0;

    if (uUseOpacityMap > 0.5) {
      vec4 opacitySample = texture2D(uOpacityMap, vUv);
      float sourceOpacityMask = getOpacityMaskSource(opacitySample);

      if (uUseOrbitOpacityMap > 0.5) {
        vec4 orbitOpacitySample = texture2D(uOrbitOpacityMap, vUv);
        float orbitSourceOpacityMask = getOpacityMaskSource(orbitOpacitySample);
        sourceOpacityMask = mix(
          sourceOpacityMask,
          orbitSourceOpacityMask,
          clamp(uOpacityMapMix, 0.0, 1.0)
        );
      }

      opacityMask = 1.0 - clamp(sourceOpacityMask, 0.0, 1.0);
    }
    opacityMask = mix(1.0, opacityMask, clamp(uOpacityMaskStrength, 0.0, 1.0));

    if (uUseEmissiveMap > 0.5) {
      vec4 emissiveSample = texture2D(uEmissiveMap, vUv);
      float emissiveMask = getMaskLuminance(emissiveSample) * emissiveSample.a * opacityMask;
      color += uEmissiveColor * emissiveMask * max(uEmissiveStrength, 0.0);
    }

    float frontViewFactor =
      pow(clamp(NdotV, 0.0, 1.0), max(uFrontViewFadePower, EPSILON)) *
      clamp(uFrontViewFadeStrength, 0.0, 1.0);
    float frontViewLuminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 frontViewDesaturated = mix(
      vec3(frontViewLuminance),
      color,
      clamp(uFrontViewSaturationMultiplier, 0.0, 1.0)
    );
    color = mix(color, frontViewDesaturated, frontViewFactor);

    float finalAlpha = clamp(uOpacity * opacityMask, 0.0, 1.0);
    finalAlpha *= mix(
      1.0,
      clamp(uFrontViewAlphaMultiplier, 0.0, 1.0),
      frontViewFactor
    );

    gl_FragColor = vec4(color, clamp(finalAlpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type CookTorranceMaterialOptions = {
  baseColor: THREE.ColorRepresentation;
  roughness: number;
  metallic: number;
  lightDirection: readonly [number, number, number];
  lightColor: THREE.ColorRepresentation;
  lightIntensity: number;
  ambientColor: THREE.ColorRepresentation;
  subsurfaceColor?: THREE.ColorRepresentation;
  subsurfaceStrength?: number;
  wrap?: number;
  rimStrength?: number;
  rimPower?: number;
  transmissionStrength?: number;
  shadowStrength?: number;
  shadowSoftness?: number;
  shadowLift?: number;
  baseSaturation?: number;
  edgeSaturation?: number;
  centerWhiteness?: number;
  faceEdgePower?: number;
  cubeHalfExtent?: number;
  colorContrast?: number;
  colorVibrance?: number;
  opacityMap?: THREE.Texture | null;
  orbitOpacityMap?: THREE.Texture | null;
  opacityMapMix?: number;
  opacityMaskStrength?: number;
  emissiveMap?: THREE.Texture | null;
  emissiveColor?: THREE.ColorRepresentation;
  emissiveStrength?: number;
  frontViewFadeStrength?: number;
  frontViewFadePower?: number;
  frontViewAlphaMultiplier?: number;
  frontViewSaturationMultiplier?: number;
  opacity: number;
};

export function createCookTorranceMaterial({
  baseColor,
  roughness,
  metallic,
  lightDirection,
  lightColor,
  lightIntensity,
  ambientColor,
  subsurfaceColor = "#f7fffb",
  subsurfaceStrength = 0,
  wrap = 0,
  rimStrength = 0,
  rimPower = 2.4,
  transmissionStrength = 0,
  shadowStrength = 0,
  shadowSoftness = 0.58,
  shadowLift = 0.38,
  baseSaturation = 1,
  edgeSaturation = 1,
  centerWhiteness = 0,
  faceEdgePower = 1.35,
  cubeHalfExtent = 1,
  colorContrast = 1,
  colorVibrance = 0,
  opacityMap = null,
  orbitOpacityMap = null,
  opacityMapMix = 0,
  opacityMaskStrength = 1,
  emissiveMap = null,
  emissiveColor = "#d7e6ff",
  emissiveStrength = 0,
  frontViewFadeStrength = 0,
  frontViewFadePower = 1.8,
  frontViewAlphaMultiplier = 0.38,
  frontViewSaturationMultiplier = 0.45,
  opacity,
}: CookTorranceMaterialOptions) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColor) },
      uRoughness: { value: roughness },
      uMetallic: { value: metallic },
      uLightDirection: { value: new THREE.Vector3(...lightDirection).normalize() },
      uLightColor: { value: new THREE.Color(lightColor) },
      uLightIntensity: { value: lightIntensity },
      uAmbientColor: { value: new THREE.Color(ambientColor) },
      uSubsurfaceColor: { value: new THREE.Color(subsurfaceColor) },
      uSubsurfaceStrength: { value: subsurfaceStrength },
      uWrap: { value: wrap },
      uRimStrength: { value: rimStrength },
      uRimPower: { value: rimPower },
      uTransmissionStrength: { value: transmissionStrength },
      uShadowStrength: { value: shadowStrength },
      uShadowSoftness: { value: shadowSoftness },
      uShadowLift: { value: shadowLift },
      uBaseSaturation: { value: baseSaturation },
      uEdgeSaturation: { value: edgeSaturation },
      uCenterWhiteness: { value: centerWhiteness },
      uFaceEdgePower: { value: faceEdgePower },
      uCubeHalfExtent: { value: cubeHalfExtent },
      uColorContrast: { value: colorContrast },
      uColorVibrance: { value: colorVibrance },
      uOpacity: { value: opacity },
      uOpacityMap: { value: opacityMap },
      uUseOpacityMap: { value: opacityMap ? 1 : 0 },
      uOrbitOpacityMap: { value: orbitOpacityMap ?? opacityMap },
      uUseOrbitOpacityMap: { value: orbitOpacityMap ? 1 : 0 },
      uOpacityMapMix: { value: opacityMapMix },
      uOpacityMaskStrength: { value: opacityMaskStrength },
      uEmissiveMap: { value: emissiveMap },
      uUseEmissiveMap: { value: emissiveMap ? 1 : 0 },
      uEmissiveColor: { value: new THREE.Color(emissiveColor) },
      uEmissiveStrength: { value: emissiveStrength },
      uFrontViewFadeStrength: { value: frontViewFadeStrength },
      uFrontViewFadePower: { value: frontViewFadePower },
      uFrontViewAlphaMultiplier: { value: frontViewAlphaMultiplier },
      uFrontViewSaturationMultiplier: { value: frontViewSaturationMultiplier },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}
