import type { BlazeFaceModel, NormalizedFace } from "@tensorflow-models/blazeface";

const BLAZEFACE_MODEL_URL = "/assets/models/blazeface/model.json";

export type ParallaxViewInput = {
  x: number;
  y: number;
  z: number;
  rawX?: number;
  relativeX?: number;
};

export type ParallaxTrackingMode = "face" | "pointer";

export type ParallaxTrackingStatus = {
  mode: ParallaxTrackingMode;
  faceDetected: boolean | null;
  input: ParallaxViewInput;
  inferenceMs?: number;
  trackingFps?: number;
};

export type ParallaxUnavailableReason = "insecure-context" | "media-unavailable";

export class ParallaxUnavailableError extends Error {
  reason: ParallaxUnavailableReason;

  constructor(reason: ParallaxUnavailableReason, message: string) {
    super(message);
    this.name = "ParallaxUnavailableError";
    this.reason = reason;
  }
}

export type ParallaxTrackingConfig = {
  fallbackToPointer: boolean;
  tracking: {
    scoreThreshold: number;
    video: {
      width: number;
      height: number;
      frameRate: number;
    };
    maxFps: number;
    smoothEyeMs: number;
    smoothDistanceMs: number;
    smoothInputMs: number;
    defaultDistance: number;
    horizontalYawWeight: number;
  };
  inputClamp: {
    x: readonly [number, number];
    y: readonly [number, number];
    z: readonly [number, number];
  };
  noFaceHoldMs: number;
};

export type ParallaxInputController = {
  mode: ParallaxTrackingMode;
  stop: () => void;
};

type CreateParallaxInputControllerOptions = {
  target: HTMLElement;
  config: ParallaxTrackingConfig;
  onView: (view: ParallaxViewInput) => void;
  onStatus?: (status: ParallaxTrackingStatus) => void;
  signal?: AbortSignal;
};

function clamp(value: number, [min, max]: readonly [number, number]) {
  return Math.min(max, Math.max(min, value));
}

function getTimeAlpha(responseMs: number, dtMs: number) {
  if (!Number.isFinite(responseMs) || responseMs <= 0) {
    return 1;
  }

  return 1 - Math.exp(-Math.max(0, dtMs) / responseMs);
}

function clampView(view: ParallaxViewInput, config: ParallaxTrackingConfig) {
  const clamped: ParallaxViewInput = {
    x: clamp(view.x, config.inputClamp.x),
    y: clamp(view.y, config.inputClamp.y),
    z: clamp(view.z, config.inputClamp.z),
  };

  if (typeof view.rawX === "number") {
    clamped.rawX = clamp(view.rawX, config.inputClamp.x);
  }

  if (typeof view.relativeX === "number") {
    clamped.relativeX = clamp(view.relativeX, config.inputClamp.x);
  }

  return clamped;
}

function getPoint(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const [x, y] = value;

  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return [x, y] as const;
}

function getFaceBoxCenter(face: NormalizedFace) {
  const faceWithBox = face as NormalizedFace & {
    topLeft?: unknown;
    bottomRight?: unknown;
  };
  const topLeft = getPoint(faceWithBox.topLeft);
  const bottomRight = getPoint(faceWithBox.bottomRight);

  if (!topLeft || !bottomRight) {
    return null;
  }

  return {
    x: (topLeft[0] + bottomRight[0]) / 2,
    y: (topLeft[1] + bottomRight[1]) / 2,
    width: Math.abs(bottomRight[0] - topLeft[0]),
  };
}

function getFaceLandmarks(face: NormalizedFace) {
  const landmarks = face.landmarks;

  if (!Array.isArray(landmarks) || landmarks.length < 2) {
    return null;
  }

  const firstEye = getPoint(landmarks[0]);
  const secondEye = getPoint(landmarks[1]);
  const nose = getPoint(landmarks[2]);

  if (!firstEye || !secondEye) {
    return null;
  }

  return {
    firstEye,
    secondEye,
    nose,
  };
}

function installPointerParallaxFallback({
  target,
  config,
  onView,
  onStatus,
  signal,
}: CreateParallaxInputControllerOptions): ParallaxInputController {
  if (signal?.aborted) {
    throw new Error("Pointer parallax fallback was aborted before startup.");
  }

  let stopped = false;
  let abortHandler: (() => void) | null = null;

  const handlePointerMove = (event: PointerEvent) => {
    if (stopped) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    const x = ((event.clientX - rect.left) / width) * 2 - 1;
    const view = clampView(
      {
        x,
        rawX: x,
        relativeX: x,
        y: 1 - ((event.clientY - rect.top) / height) * 2,
        z: 1,
      },
      config,
    );

    onView(view);
    onStatus?.({ mode: "pointer", faceDetected: null, input: view });
  };

  const handlePointerLeave = () => {
    onView({ x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 });
    onStatus?.({
      mode: "pointer",
      faceDetected: null,
      input: { x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 },
    });
  };

  const controller: ParallaxInputController = {
    mode: "pointer",
    stop: () => {
      stopped = true;
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerleave", handlePointerLeave);
      if (abortHandler) {
        signal?.removeEventListener("abort", abortHandler);
      }
      onView({ x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 });
      onStatus?.({
        mode: "pointer",
        faceDetected: null,
        input: { x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 },
      });
    },
  };

  target.addEventListener("pointermove", handlePointerMove);
  target.addEventListener("pointerleave", handlePointerLeave);
  abortHandler = () => controller.stop();
  signal?.addEventListener("abort", abortHandler, { once: true });
  onView({ x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 });
  onStatus?.({
    mode: "pointer",
    faceDetected: null,
    input: { x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 },
  });

  return controller;
}

async function waitForVideoMetadata(video: HTMLVideoElement, signal?: AbortSignal) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Webcam metadata wait was aborted."));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for webcam metadata."));
    }, 6000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };

    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Failed to load webcam metadata."));
    };

    const handleAbort = () => {
      cleanup();
      reject(new Error("Webcam metadata wait was aborted."));
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

async function createFaceParallaxTracker({
  target,
  config,
  onView,
  onStatus,
  signal,
}: CreateParallaxInputControllerOptions): Promise<ParallaxInputController> {
  if (!window.isSecureContext) {
    throw new ParallaxUnavailableError(
      "insecure-context",
      "Camera parallax requires a secure context.",
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ParallaxUnavailableError(
      "media-unavailable",
      "getUserMedia is unavailable in this browser context.",
    );
  }

  if (signal?.aborted) {
    throw new Error("Face parallax tracker was aborted before startup.");
  }

  let stopped = false;
  let tickTimeout: number | null = null;
  let stream: MediaStream | null = null;
  let model: BlazeFaceModel | null = null;
  let smoothedEyes: [number, number, number, number] | null = null;
  let smoothedDistance: number | null = null;
  let smoothedView: ParallaxViewInput | null = null;
  let neutralCenterX: number | null = null;
  let neutralReferenceWidth: number | null = null;
  let lastSampleAt: number | null = null;
  let lastTrackingFpsAt: number | null = null;
  let trackingFps = 0;
  let lastFaceAt = performance.now();

  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  const stop = () => {
    stopped = true;

    if (tickTimeout !== null) {
      window.clearTimeout(tickTimeout);
      tickTimeout = null;
    }

    model?.dispose?.();
    model = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.pause();
    video.srcObject = null;
    signal?.removeEventListener("abort", stop);
    onView({ x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 });
    onStatus?.({
      mode: "face",
      faceDetected: false,
      input: { x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 },
    });
  };

  signal?.addEventListener("abort", stop, { once: true });

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: config.tracking.video.width },
        height: { ideal: config.tracking.video.height },
        frameRate: {
          ideal: config.tracking.video.frameRate,
          max: config.tracking.video.frameRate,
        },
      },
    });

    if (stopped || signal?.aborted) {
      throw new Error("Face parallax tracker stopped before startup.");
    }

    video.srcObject = stream;
    await waitForVideoMetadata(video, signal);
    await video.play();

    if (stopped || signal?.aborted) {
      throw new Error("Face parallax tracker stopped before model startup.");
    }

    const [tf, blazeface, tfConverter] = await Promise.all([
      import("@tensorflow/tfjs-core"),
      import("@tensorflow-models/blazeface/dist/face"),
      import("@tensorflow/tfjs-converter"),
      import("@tensorflow/tfjs-backend-webgl"),
    ]).then(([tfModule, blazefaceModule, tfConverterModule]) => [
      tfModule,
      blazefaceModule,
      tfConverterModule,
    ] as const);

    await tf.setBackend("webgl");
    await tf.ready();

    const graphModel = await tfConverter.loadGraphModel(BLAZEFACE_MODEL_URL);
    model = new blazeface.BlazeFaceModel(
      graphModel,
      128,
      128,
      1,
      0.3,
      config.tracking.scoreThreshold,
    );

    if (stopped || signal?.aborted) {
      throw new Error("Face parallax tracker stopped after model startup.");
    }
  } catch (error) {
    stop();
    throw error;
  }

  const scheduleTick = (delayMs: number) => {
    if (stopped || !model) {
      return;
    }

    tickTimeout = window.setTimeout(() => {
      tickTimeout = null;
      void tick();
    }, Math.max(0, delayMs));
  };

  const tick = async () => {
    if (stopped || !model) {
      return;
    }

    const tickStartedAt = performance.now();
    let inferenceMs = 0;

    try {
      const inferenceStartedAt = performance.now();
      const faces = await model.estimateFaces(video, false, true, true);
      inferenceMs = performance.now() - inferenceStartedAt;

      if (stopped) {
        return;
      }

      const sampleAt = performance.now();
      const sampleDt = lastSampleAt === null ? 1000 / Math.max(1, config.tracking.maxFps) : sampleAt - lastSampleAt;
      lastSampleAt = sampleAt;
      trackingFps =
        lastTrackingFpsAt === null ? 0 : 1000 / Math.max(1, sampleAt - lastTrackingFpsAt);
      lastTrackingFpsAt = sampleAt;

      const face = faces[0];
      const faceLandmarks = face ? getFaceLandmarks(face) : null;
      const width = Math.max(1, video.videoWidth);
      const height = Math.max(1, video.videoHeight);

      if (faceLandmarks) {
        const nextEyes: [number, number, number, number] = [
          faceLandmarks.firstEye[0],
          faceLandmarks.firstEye[1],
          faceLandmarks.secondEye[0],
          faceLandmarks.secondEye[1],
        ];

        if (!smoothedEyes) {
          smoothedEyes = nextEyes;
        } else {
          const eyeAlpha = getTimeAlpha(config.tracking.smoothEyeMs, sampleDt);
          for (let index = 0; index < smoothedEyes.length; index += 1) {
            smoothedEyes[index] =
              smoothedEyes[index] * (1 - eyeAlpha) + nextEyes[index] * eyeAlpha;
          }
        }

        const eyeDistance = Math.hypot(
          smoothedEyes[0] - smoothedEyes[2],
          smoothedEyes[1] - smoothedEyes[3],
        );
        const nextDistance = eyeDistance / width;

        smoothedDistance =
          smoothedDistance === null
            ? nextDistance
            : smoothedDistance * (1 - getTimeAlpha(config.tracking.smoothDistanceMs, sampleDt)) +
              nextDistance * getTimeAlpha(config.tracking.smoothDistanceMs, sampleDt);
        lastFaceAt = performance.now();

        const eyeCenterX = (smoothedEyes[0] + smoothedEyes[2]) / 2;
        const eyeCenterY = (smoothedEyes[1] + smoothedEyes[3]) / 2;
        const faceBoxCenter = getFaceBoxCenter(face);
        const horizontalCenterX = faceBoxCenter?.x ?? eyeCenterX;
        const referenceWidth = Math.max(1, faceBoxCenter?.width ?? eyeDistance);
        if (neutralCenterX === null || neutralReferenceWidth === null) {
          neutralCenterX = horizontalCenterX;
          neutralReferenceWidth = referenceWidth;
        }

        const noseOffsetX = faceLandmarks.nose
          ? ((faceLandmarks.nose[0] - eyeCenterX) / Math.max(1, eyeDistance)) *
            config.tracking.horizontalYawWeight
          : 0;
        const rawX = (horizontalCenterX / width) * 2 - 1 + noseOffsetX;
        const relativeX =
          (horizontalCenterX - neutralCenterX) / Math.max(1, neutralReferenceWidth) + noseOffsetX;

        const rawView = clampView(
          {
            x: rawX,
            rawX,
            relativeX,
            y: 1 - (eyeCenterY / height) * 2,
            z: config.tracking.defaultDistance / Math.max(0.0001, smoothedDistance),
          },
          config,
        );
        const inputAlpha = getTimeAlpha(config.tracking.smoothInputMs, sampleDt);
        const view =
          smoothedView === null
            ? rawView
            : clampView(
                {
                  x: smoothedView.x * (1 - inputAlpha) + rawView.x * inputAlpha,
                  y: smoothedView.y * (1 - inputAlpha) + rawView.y * inputAlpha,
                  z: smoothedView.z * (1 - inputAlpha) + rawView.z * inputAlpha,
                  rawX:
                    (smoothedView.rawX ?? smoothedView.x) * (1 - inputAlpha) +
                    (rawView.rawX ?? rawView.x) * inputAlpha,
                  relativeX:
                    (smoothedView.relativeX ?? smoothedView.x) * (1 - inputAlpha) +
                    (rawView.relativeX ?? rawView.x) * inputAlpha,
                },
                config,
              );
        smoothedView = view;

        onView(view);
        onStatus?.({
          mode: "face",
          faceDetected: true,
          input: view,
          inferenceMs,
          trackingFps,
        });
      } else if (performance.now() - lastFaceAt > config.noFaceHoldMs) {
        neutralCenterX = null;
        neutralReferenceWidth = null;
        smoothedView = null;
        const view = { x: 0, y: 0, z: 1, rawX: 0, relativeX: 0 };

        onView(view);
        onStatus?.({
          mode: "face",
          faceDetected: false,
          input: view,
          inferenceMs,
          trackingFps,
        });
      }
    } catch (error) {
      console.warn("Face parallax tracking failed.", error);
      stop();
      return;
    }

    const targetIntervalMs = 1000 / Math.max(1, config.tracking.maxFps);
    scheduleTick(targetIntervalMs - (performance.now() - tickStartedAt));
  };

  scheduleTick(0);

  return {
    mode: "face",
    stop,
  };
}

export async function createParallaxInputController(
  options: CreateParallaxInputControllerOptions,
): Promise<ParallaxInputController> {
  try {
    return await createFaceParallaxTracker(options);
  } catch (error) {
    if (error instanceof ParallaxUnavailableError) {
      throw error;
    }

    if (!options.config.fallbackToPointer) {
      throw error;
    }

    console.warn("Falling back to pointer parallax input.", error);
    return installPointerParallaxFallback(options);
  }
}
