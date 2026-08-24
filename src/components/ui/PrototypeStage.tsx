import { gsap } from "gsap";
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { prototypeParams } from "../../config/prototypeParams";
import { getGuiScaleForViewport } from "../../utils/guiScale";

type StageViewportMetrics = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  guiScale: number;
};

type StageStyle = CSSProperties &
  Record<
    | "--viewport-width"
    | "--viewport-height"
    | "--viewport-center-x"
    | "--viewport-center-y"
    | "--safe-top"
    | "--safe-right"
    | "--safe-bottom"
    | "--safe-left"
    | "--gui-scale",
    string
  >;

function getStageViewportMetrics(): StageViewportMetrics {
  if (typeof window === "undefined") {
    return {
      width: 1920,
      height: 1080,
      centerX: 960,
      centerY: 540,
      safeTop: 16,
      safeRight: 1904,
      safeBottom: 1064,
      safeLeft: 16,
      guiScale: getGuiScaleForViewport(1920, 1080),
    };
  }

  const safeMargin = 16;
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    safeTop: safeMargin,
    safeRight: width - safeMargin,
    safeBottom: height - safeMargin,
    safeLeft: safeMargin,
    guiScale: getGuiScaleForViewport(width, height),
  };
}

const StageScaleContext = createContext(1);

export function useStageScale() {
  return useContext(StageScaleContext);
}

type PrototypeStageProps = {
  children: ReactNode;
  backgroundSrc: string | null;
  backgroundImageClassName?: string;
  backgroundOverlayClassName?: string;
};

type BackgroundLayer = {
  id: number;
  src: string;
  imageClassName: string;
  overlayClassName: string;
  isActive: boolean;
};

type BackgroundLayerViewProps = {
  layer: BackgroundLayer;
  onExitDone: (id: number) => void;
};

function BackgroundLayerView({ layer, onExitDone }: BackgroundLayerViewProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!layerRef.current) {
      return;
    }

    const duration = prototypeParams.transitions.backgroundCrossfadeDuration;
    const ease = prototypeParams.transitions.pageTransitionEase;

    if (layer.isActive) {
      const tween = gsap.fromTo(
        layerRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration, ease, overwrite: "auto" },
      );

      return () => {
        tween.kill();
      };
    }

    const tween = gsap.to(layerRef.current, {
      autoAlpha: 0,
      duration,
      ease,
      overwrite: "auto",
      onComplete: () => onExitDone(layer.id),
    });

    return () => {
      tween.kill();
    };
  }, [layer.id, layer.isActive, onExitDone]);

  return (
    <div ref={layerRef} className="prototype-background-layer" data-background-layer>
      <img
        src={layer.src}
        alt=""
        className={`prototype-background-image ${layer.imageClassName}`}
        draggable={false}
      />
      {layer.overlayClassName ? (
        <div className={`prototype-background-overlay ${layer.overlayClassName}`} />
      ) : null}
    </div>
  );
}

export function PrototypeStage({
  children,
  backgroundSrc,
  backgroundImageClassName = "",
  backgroundOverlayClassName = "",
}: PrototypeStageProps) {
  const backgroundLayerIdRef = useRef(0);
  const [viewportMetrics, setViewportMetrics] = useState(() =>
    getStageViewportMetrics(),
  );
  const [backgroundLayers, setBackgroundLayers] = useState<BackgroundLayer[]>(() =>
    backgroundSrc
      ? [
          {
            id: 0,
            src: backgroundSrc,
            imageClassName: backgroundImageClassName,
            overlayClassName: backgroundOverlayClassName,
            isActive: true,
          },
        ]
      : [],
  );

  useEffect(() => {
    const handleResize = () => setViewportMetrics(getStageViewportMetrics());

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setBackgroundLayers((currentLayers) => {
      const currentLayer = currentLayers.find((layer) => layer.isActive);

      if (!backgroundSrc) {
        if (!currentLayer) {
          return currentLayers;
        }

        return currentLayers.map((layer) => ({ ...layer, isActive: false }));
      }

      if (
        currentLayer?.src === backgroundSrc &&
        currentLayer.imageClassName === backgroundImageClassName &&
        currentLayer.overlayClassName === backgroundOverlayClassName
      ) {
        return currentLayers;
      }

      backgroundLayerIdRef.current += 1;

      return [
        ...currentLayers.map((layer) => ({ ...layer, isActive: false })),
        {
          id: backgroundLayerIdRef.current,
          src: backgroundSrc,
          imageClassName: backgroundImageClassName,
          overlayClassName: backgroundOverlayClassName,
          isActive: true,
        },
      ];
    });
  }, [backgroundSrc, backgroundImageClassName, backgroundOverlayClassName]);

  const removeBackgroundLayer = useCallback((id: number) => {
    setBackgroundLayers((currentLayers) =>
      currentLayers.filter((layer) => layer.isActive || layer.id !== id),
    );
  }, []);

  const stageStyle = {
    "--viewport-width": `${viewportMetrics.width}px`,
    "--viewport-height": `${viewportMetrics.height}px`,
    "--viewport-center-x": `${viewportMetrics.centerX}px`,
    "--viewport-center-y": `${viewportMetrics.centerY}px`,
    "--safe-top": `${viewportMetrics.safeTop}px`,
    "--safe-right": `${viewportMetrics.safeRight}px`,
    "--safe-bottom": `${viewportMetrics.safeBottom}px`,
    "--safe-left": `${viewportMetrics.safeLeft}px`,
    "--gui-scale": `${viewportMetrics.guiScale}`,
  } as StageStyle;

  return (
    <main className="prototype-root">
      <section
        className="prototype-stage"
        style={stageStyle}
        aria-label="User Story Cube View prototype"
      >
        {/* <div className="prototype-background" aria-hidden="true">
          {backgroundLayers.map((layer) => (
            <BackgroundLayerView
              key={layer.id}
              layer={layer}
              onExitDone={removeBackgroundLayer}
            />
          ))}
        </div> */}

        <StageScaleContext.Provider value={viewportMetrics.guiScale}>
          <div className="prototype-canvas text-crisp">{children}</div>
        </StageScaleContext.Provider>
      </section>
    </main>
  );
}
