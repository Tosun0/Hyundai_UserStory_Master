// @ts-nocheck
import * as THREE from "three";

export function applyCubeIdleMotion({
  position,
  rotation,
  basePosition,
  sceneTime,
  strength,
  config,
}: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  basePosition: THREE.Vector3;
  sceneTime: number;
  strength: number;
  config: {
    periodSeconds: number;
    verticalAmplitude: number;
    lateralAmplitude: number;
    depthAmplitude: number;
    rotationAmplitude: readonly [number, number, number];
  };
}) {
  if (strength <= 0) {
    return;
  }

  const seed =
    basePosition.x * 0.754877666 +
    basePosition.y * 0.569840296 +
    basePosition.z * 0.438289471;
  const cycle = (sceneTime / config.periodSeconds) * Math.PI * 2;
  const phaseX = cycle * (0.83 + Math.sin(seed * 1.7) * 0.12) + seed * 1.31;
  const phaseY = cycle * (1.07 + Math.cos(seed * 1.1) * 0.14) + seed * 1.73;
  const phaseZ = cycle * (0.69 + Math.sin(seed * 0.9) * 0.11) + seed * 2.17;

  position.x += Math.sin(phaseX) * config.lateralAmplitude * strength;
  position.y += Math.sin(phaseY) * config.verticalAmplitude * strength;
  position.z += Math.cos(phaseZ) * config.depthAmplitude * strength;
  rotation.x += Math.sin(phaseY * 0.61) * config.rotationAmplitude[0] * strength;
  rotation.y += Math.cos(phaseX * 0.57) * config.rotationAmplitude[1] * strength;
  rotation.z += Math.sin(phaseZ * 0.73) * config.rotationAmplitude[2] * strength;
}
