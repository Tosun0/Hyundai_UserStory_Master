import { gsap } from "gsap";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { LandingScreen } from "./components/screens/LandingScreen";
import { SearchScreen } from "./components/screens/SearchScreen";
import { MinimalCubeLoader } from "./components/ui/MinimalCubeLoader";
import { PrototypeStage } from "./components/ui/PrototypeStage";
import { prototypeParams } from "./config/prototypeParams";
import { prototypeAssets, type ScreenId } from "./data/prototypeContent";
import type { PlaybookAccessGroup } from "./data/playbookCatalog";

const screenBackgrounds: Record<
  ScreenId,
  {
    src: string | null;
    imageClassName?: string;
    overlayClassName?: string;
  }
> = {
  landing: {
    src: prototypeAssets.landingBg,
    imageClassName: "scale-[1.04] blur-[30px]",
    overlayClassName: "bg-[rgba(212,212,212,0.2)]",
  },
  search: {
    src: null,
  },
};

type LoadingOverlayState = {
  isMounted: boolean;
  isVisible: boolean;
};

const MASTER_CUBE_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const isLayoutPreview =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("layout-preview");

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function preloadImage(src: string | null) {
  if (!src) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>(isLayoutPreview ? "search" : "landing");
  const [playbookGroup, setPlaybookGroup] = useState<PlaybookAccessGroup>(
    isLayoutPreview ? "ALL" : "H",
  );
  const [loadingOverlay, setLoadingOverlay] = useState<LoadingOverlayState>({
    isMounted: true,
    isVisible: true,
  });
  const screenRef = useRef<HTMLDivElement>(null);
  const activeScreenRef = useRef<ScreenId>(screen);
  const isTransitioningRef = useRef(false);
  const isLoadingOverlayActiveRef = useRef(true);
  const loadingOverlayExitTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const background = screenBackgrounds[screen];

  const showLoadingOverlay = useCallback(() => {
    if (loadingOverlayExitTimerRef.current !== null) {
      window.clearTimeout(loadingOverlayExitTimerRef.current);
      loadingOverlayExitTimerRef.current = null;
    }

    isLoadingOverlayActiveRef.current = true;
    setLoadingOverlay({ isMounted: true, isVisible: true });
  }, []);

  const hideLoadingOverlay = useCallback(() => {
    const fadeDurationMs = prototypeParams.loading.overlayFadeDuration * 1000;

    isLoadingOverlayActiveRef.current = false;
    setLoadingOverlay((currentState) =>
      currentState.isMounted ? { isMounted: true, isVisible: false } : currentState,
    );

    if (loadingOverlayExitTimerRef.current !== null) {
      window.clearTimeout(loadingOverlayExitTimerRef.current);
    }

    loadingOverlayExitTimerRef.current = window.setTimeout(() => {
      loadingOverlayExitTimerRef.current = null;
      setLoadingOverlay((currentState) =>
        currentState.isVisible ? currentState : { isMounted: false, isVisible: false },
      );
    }, fadeDurationMs);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const runInitialLoading = async () => {
      await Promise.all([
        preloadImage(prototypeAssets.landingBg),
        wait(prototypeParams.loading.minimumDurationMs),
      ]);

      if (!isCancelled) {
        hideLoadingOverlay();
      }
    };

    void runInitialLoading();

    return () => {
      isCancelled = true;
    };
  }, [hideLoadingOverlay]);

  useEffect(() => {
    activeScreenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    return () => {
      if (loadingOverlayExitTimerRef.current !== null) {
        window.clearTimeout(loadingOverlayExitTimerRef.current);
      }

      if (screenRef.current) {
        gsap.killTweensOf(screenRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!screenRef.current) {
      return;
    }

    const context = gsap.context(() => {
      const screenElement = screenRef.current;

      if (!screenElement) {
        return;
      }

      gsap.fromTo(
        screenElement,
        { autoAlpha: 0, scale: 1.018, y: 12 },
        {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: prototypeParams.transitions.pageTransitionEnterDuration,
          ease: prototypeParams.transitions.pageTransitionEase,
          overwrite: "auto",
          transformOrigin: "50% 50%",
          onComplete: () => {
            isTransitioningRef.current = false;
            gsap.set(screenElement, { clearProps: "opacity,visibility,transform" });
          },
        },
      );
    }, screenRef);

    return () => context.revert();
  }, [screen]);

  const goToScreen = useCallback(
    (nextScreen: ScreenId) => {
      const currentScreen = activeScreenRef.current;

      if (
        nextScreen === currentScreen ||
        isTransitioningRef.current ||
        isLoadingOverlayActiveRef.current
      ) {
        return false;
      }

      const screenElement = screenRef.current;

      if (!screenElement) {
        activeScreenRef.current = nextScreen;
        setScreen(nextScreen);
        return true;
      }

      isTransitioningRef.current = true;
      gsap.killTweensOf(screenElement);
      gsap.to(screenElement, {
        autoAlpha: 0,
        scale: 0.972,
        y: -12,
        duration: prototypeParams.transitions.pageTransitionExitDuration,
        ease: prototypeParams.transitions.pageTransitionEase,
        overwrite: "auto",
        transformOrigin: "50% 50%",
        onComplete: () => {
          activeScreenRef.current = nextScreen;
          setScreen(nextScreen);
        },
      });

      return true;
    },
    [],
  );

  const logoutToLanding = useCallback(() => {
    if (screenRef.current) {
      gsap.killTweensOf(screenRef.current);
      gsap.set(screenRef.current, { clearProps: "opacity,visibility,transform" });
    }

    isTransitioningRef.current = false;
    activeScreenRef.current = "landing";
    setPlaybookGroup("H");
    setScreen("landing");
  }, []);

  useEffect(() => {
    if (screen !== "search") {
      return;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
      }

      inactivityTimerRef.current = window.setTimeout(
        logoutToLanding,
        MASTER_CUBE_INACTIVITY_TIMEOUT_MS,
      );
    };

    const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });

      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [logoutToLanding, screen]);

  return (
    <PrototypeStage
      backgroundSrc={background.src}
      backgroundImageClassName={background.imageClassName}
      backgroundOverlayClassName={background.overlayClassName}
    >
      <div ref={screenRef} className="screen-fill">
        {screen === "landing" ? (
          <LandingScreen
            onGoToSearch={(group) => {
              setPlaybookGroup(group);
              goToScreen("search");
            }}
          />
        ) : null}
        {screen === "search" ? (
          <SearchScreen
            isActive
            playbookGroup={playbookGroup}
            onLogout={logoutToLanding}
          />
        ) : null}
      </div>

      {loadingOverlay.isMounted ? (
        <MinimalCubeLoader
          variant="fullscreen"
          isExiting={!loadingOverlay.isVisible}
          dataName="app/global-loading-indicator"
          style={
            {
              "--minimal-cube-loader-fade-duration": `${prototypeParams.loading.overlayFadeDuration}s`,
            } as CSSProperties
          }
        />
      ) : null}
    </PrototypeStage>
  );
}
