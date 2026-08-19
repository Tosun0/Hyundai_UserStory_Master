// @ts-nocheck
import * as THREE from "three";

export type CubeEntryAnimationConfig = {
  cameraDuration: number;
  cameraDistance: number;
  cameraSideOffset: number;
  cameraLift: number;
  cameraSweep: number;
  cameraArcLift: number;
  sway: number;
  rotation: readonly [number, number, number];
  startScale: number;
  lift: number;
  assemblyDistance: number;
};

export type CubeEntryCameraState = {
  active: boolean;
  startTime: number | null;
  duration: number;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  center: THREE.Vector3;
  side: THREE.Vector3;
  target: THREE.Vector3;
  sweep: number;
  arcLift: number;
};

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - THREE.MathUtils.clamp(progress, 0, 1), 3);
}

function easeOutBack(progress: number, overshoot = 1.2) {
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1) - 1;
  return (
    clampedProgress *
      clampedProgress *
      ((overshoot + 1) * clampedProgress + overshoot) +
    1
  );
}

export function createCubeEntryCameraState(
  endPosition: THREE.Vector3,
  center: THREE.Vector3,
  config: CubeEntryAnimationConfig,
) {
  const direction = endPosition.clone().sub(center).normalize();
  const side = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), direction)
    .normalize();

  return {
    active: false,
    startTime: null,
    duration: config.cameraDuration,
    startPosition: endPosition
      .clone()
      .addScaledVector(direction, config.cameraDistance)
      .addScaledVector(side, config.cameraSideOffset)
      .add(new THREE.Vector3(0, config.cameraLift, 0)),
    endPosition: endPosition.clone(),
    center: center.clone(),
    side,
    target: center.clone(),
    sweep: config.cameraSweep,
    arcLift: config.cameraArcLift,
  } satisfies CubeEntryCameraState;
}

export function startCubeEntryCamera(state: CubeEntryCameraState, startTime: number) {
  state.active = true;
  state.startTime = startTime;
}

export function updateCubeEntryCamera(
  state: CubeEntryCameraState,
  frameTime: number,
  cameraPosition: THREE.Vector3,
  controlsTarget: THREE.Vector3,
) {
  if (!state.active || state.startTime === null) {
    return false;
  }

  const progress = THREE.MathUtils.clamp(
    (frameTime - state.startTime) / state.duration,
    0,
    1,
  );
  const easedProgress = easeOutCubic(progress);
  const arcProgress = Math.sin(progress * Math.PI);

  cameraPosition.lerpVectors(state.startPosition, state.endPosition, easedProgress);
  cameraPosition.addScaledVector(state.side, arcProgress * state.sweep);
  cameraPosition.y += arcProgress * state.arcLift;
  controlsTarget.copy(state.center).addScaledVector(state.side, arcProgress * 5);

  if (progress >= 1) {
    cameraPosition.copy(state.endPosition);
    controlsTarget.copy(state.center);
    state.active = false;
    return true;
  }

  return false;
}

export function updateCubeEntryPose({
  position,
  rotation,
  scale,
  targetPosition,
  basePosition,
  enterStart,
  progress,
  sceneTime,
  targetScale,
  config,
}: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  targetPosition: THREE.Vector3;
  basePosition: THREE.Vector3;
  enterStart: number;
  progress: number;
  sceneTime: number;
  targetScale: number;
  config: CubeEntryAnimationConfig;
}) {
  const arcProgress = Math.sin(progress * Math.PI);
  const entryPhase = enterStart * 0.0017 + basePosition.x * 0.13;
  const assemblyProgress = 1 - easeOutCubic(progress);
  const assemblyDirection = new THREE.Vector3(
    Math.sin(entryPhase * 1.31),
    Math.cos(entryPhase * 0.87),
    Math.sin(entryPhase * 0.61 + 1.7),
  ).normalize();

  position.copy(targetPosition);
  position.y += config.lift * (1 - progress);
  position.addScaledVector(assemblyDirection, assemblyProgress * config.assemblyDistance);
  position.x += Math.sin(sceneTime * 3.1 + entryPhase) * arcProgress * config.sway;
  position.z +=
    Math.cos(sceneTime * 2.7 + entryPhase * 1.23) * arcProgress * config.sway;

  scale.setScalar(
    progress <= 0
      ? 0
      : THREE.MathUtils.lerp(
          config.startScale,
          targetScale,
          easeOutBack(progress),
        ),
  );
  rotation.set(
    Math.sin(sceneTime * 2.4 + entryPhase) * arcProgress * config.rotation[0],
    Math.cos(sceneTime * 2.1 + entryPhase * 1.17) * arcProgress * config.rotation[1],
    Math.sin(sceneTime * 1.8 + entryPhase * 0.83) * arcProgress * config.rotation[2],
  );
}
