// @ts-nocheck
import * as THREE from "three";

export function applyCubeIdleMotion({
  position,
  rotation,
  basePosition,
  center,
  sceneTime,
  strength,
  unit,
  config,
}: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  basePosition: THREE.Vector3;
  center: THREE.Vector3;
  sceneTime: number;
  strength: number;
  unit: number;
  config: {
    periodSeconds: number;
    waveLengthUnits: number;
    verticalAmplitude: number;
    lateralAmplitude: number;
    depthAmplitude: number;
    rotationAmplitude: readonly [number, number, number];
  };
}) {
  if (strength <= 0) {
    return;
  }

  const cycle = (sceneTime / config.periodSeconds) * Math.PI * 2;
  const offsetX = basePosition.x - center.x;
  const offsetZ = basePosition.z - center.z;
  const radialDistance = Math.hypot(offsetX, offsetZ);
  const layerPhase = basePosition.y * 0.037;
  const wavePhase =
    cycle -
    (radialDistance / Math.max(unit * config.waveLengthUnits, 0.001)) * Math.PI * 2 +
    layerPhase;
  const organicPhase = Math.sin(cycle * 0.43 + layerPhase) * 0.28;

  position.x += Math.sin(wavePhase * 0.71 + organicPhase) * config.lateralAmplitude * strength;
  position.y += Math.sin(wavePhase + organicPhase) * config.verticalAmplitude * strength;
  position.z += Math.cos(wavePhase * 0.63 - organicPhase) * config.depthAmplitude * strength;
  rotation.x += Math.sin(wavePhase * 0.67) * config.rotationAmplitude[0] * strength;
  rotation.y += Math.cos(wavePhase * 0.53) * config.rotationAmplitude[1] * strength;
  rotation.z += Math.sin(wavePhase * 0.79) * config.rotationAmplitude[2] * strength;
}
