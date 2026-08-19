// @ts-nocheck
import * as THREE from "three";

export function applyCubeIdleMotion({
  position,
  rotation,
  scale,
  basePosition,
  center,
  sceneTime,
  strength,
  unit,
  config,
}: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  basePosition: THREE.Vector3;
  center: THREE.Vector3;
  sceneTime: number;
  strength: number;
  unit: number;
  config: {
    periodSeconds: number;
    normalWavePeriodSeconds: number;
    normalWaveAmplitude: number;
    normalWaveSpatialFrequency: number;
    normalWavePulsePower: number;
    normalWaveScaleAmplitude: number;
    normalWaveRotationAmplitude: number;
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

  const deltaX = basePosition.x - center.x;
  const deltaY = basePosition.y - center.y;
  const deltaZ = basePosition.z - center.z;
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);
  const absoluteZ = Math.abs(deltaZ);
  const gridX = basePosition.x / Math.max(unit, 0.001);
  const gridY = basePosition.y / Math.max(unit, 0.001);
  const gridZ = basePosition.z / Math.max(unit, 0.001);
  const spatialPhase =
    (gridX * 0.74 + gridY * 1.0 + gridZ * 0.58) *
    config.normalWaveSpatialFrequency;
  const normalWavePhase =
    (sceneTime / config.normalWavePeriodSeconds) * Math.PI * 2 -
    spatialPhase +
    Math.sin(gridX * 0.83 - gridZ * 0.61 + cycle * 0.31) * 0.42 +
    Math.sin(seed) * 0.08;
  const normalWave = Math.sin(normalWavePhase) * 0.5 + 0.5;
  const normalPulse =
    -Math.pow(normalWave, config.normalWavePulsePower) *
    config.normalWaveAmplitude *
    strength;
  const normalBend =
    Math.cos(normalWavePhase) * config.normalWaveRotationAmplitude * strength;
  scale.multiplyScalar(
    1 +
      -Math.pow(normalWave, config.normalWavePulsePower * 0.82) *
        config.normalWaveScaleAmplitude *
        strength,
  );

  if (absoluteX >= absoluteY && absoluteX >= absoluteZ) {
    position.x += Math.sign(deltaX || Math.sin(seed)) * normalPulse;
    rotation.y += normalBend;
    rotation.z -= normalBend * 0.7;
  } else if (absoluteY >= absoluteZ) {
    position.y += Math.sign(deltaY || Math.cos(seed)) * normalPulse;
    rotation.x -= normalBend * 0.75;
    rotation.z += normalBend;
  } else {
    position.z += Math.sign(deltaZ || Math.sin(seed)) * normalPulse;
    rotation.x += normalBend;
    rotation.y -= normalBend * 0.7;
  }
}
