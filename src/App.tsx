import { gsap } from "gsap";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { DetailScreen } from "./components/screens/DetailScreen";
import { LandingScreen } from "./components/screens/LandingScreen";
import { SearchScreen } from "./components/screens/SearchScreen";
import { MinimalCubeLoader } from "./components/ui/MinimalCubeLoader";
import { PrototypeStage } from "./components/ui/PrototypeStage";
import { prototypeParams } from "./config/prototypeParams";
import {
  initialComments,
  prototypeAssets,
  type CommentItem,
  type PollOptionId,
  type ReactionId,
  type ScreenId,
} from "./data/prototypeContent";
import {
  getNextCommentPosition,
  clampCommentPosition,
  getInitialCommentStackPositions,
  resolveCommentCollisions,
  resolveNonOverlappingPosition,
  type CommentPosition,
  type CommentVelocity,
} from "./utils/commentLayout";

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
  detail: {
    src: null,
  },
};

type LoadingOverlayState = {
  isMounted: boolean;
  isVisible: boolean;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
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

function preloadVideo(src: string | null) {
  if (!src || typeof document === "undefined") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const video = document.createElement("video");
    let isResolved = false;

    const resolveOnce = () => {
      if (isResolved) {
        return;
      }

      isResolved = true;
      video.removeEventListener("loadeddata", resolveOnce);
      video.removeEventListener("error", resolveOnce);
      resolve();
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadeddata", resolveOnce);
    video.addEventListener("error", resolveOnce);
    video.src = src;
    video.load();
  });
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("landing");
  const [loadingOverlay, setLoadingOverlay] = useState<LoadingOverlayState>({
    isMounted: true,
    isVisible: true,
  });
  const [selectedPollOption, setSelectedPollOption] = useState<PollOptionId | null>(null);
  const [isPollSubmitted, setIsPollSubmitted] = useState(false);
  const [empathyCount, setEmpathyCount] = useState(460);
  const [hasIncrementedEmpathy, setHasIncrementedEmpathy] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>(() => {
    const initialCommentStackPositions = getInitialCommentStackPositions(2);

    return resolveCommentCollisions(
      initialComments.map((comment, index) => ({
        ...comment,
        position: clampCommentPosition(initialCommentStackPositions[index] ?? comment.position),
      })),
    );
  });
  const screenRef = useRef<HTMLDivElement>(null);
  const activeScreenRef = useRef<ScreenId>(screen);
  const isTransitioningRef = useRef(false);
  const isLoadingOverlayActiveRef = useRef(true);
  const loadingOverlayExitTimerRef = useRef<number | null>(null);
  const commentsRef = useRef(comments);
  const hasIncrementedEmpathyRef = useRef(false);
  const inertiaFrameRef = useRef<number | null>(null);
  const background = screenBackgrounds[screen];

  const showLoadingOverlay = useCallback(() => {
    if (loadingOverlayExitTimerRef.current !== null) {
      window.clearTimeout(loadingOverlayExitTimerRef.current);
      loadingOverlayExitTimerRef.current = null;
    }

    isLoadingOverlayActiveRef.current = true;
    setLoadingOverlay({
      isMounted: true,
      isVisible: true,
    });
  }, []);

  const hideLoadingOverlay = useCallback(() => {
    const fadeDurationMs = prototypeParams.loading.overlayFadeDuration * 1000;

    isLoadingOverlayActiveRef.current = false;
    setLoadingOverlay((currentState) =>
      currentState.isMounted
        ? {
            isMounted: true,
            isVisible: false,
          }
        : currentState,
    );

    if (loadingOverlayExitTimerRef.current !== null) {
      window.clearTimeout(loadingOverlayExitTimerRef.current);
    }

    loadingOverlayExitTimerRef.current = window.setTimeout(() => {
      loadingOverlayExitTimerRef.current = null;
      setLoadingOverlay((currentState) =>
        currentState.isVisible
          ? currentState
          : {
              isMounted: false,
              isVisible: false,
            },
      );
    }, fadeDurationMs);
  }, []);

  const runLoadingGate = useCallback(
    async (preloadMedia: () => Promise<void>) => {
      showLoadingOverlay();

      await Promise.all([
        preloadMedia(),
        wait(prototypeParams.loading.minimumDurationMs),
      ]);

      hideLoadingOverlay();
    },
    [hideLoadingOverlay, showLoadingOverlay],
  );

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    const handleResize = () => {
      setComments((currentComments) =>
        resolveCommentCollisions(
          currentComments.map((comment) => ({
            ...comment,
            position: clampCommentPosition(comment.position),
          })),
        ),
      );
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    activeScreenRef.current = screen;
  }, [screen]);

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
    return () => {
      if (inertiaFrameRef.current !== null) {
        window.cancelAnimationFrame(inertiaFrameRef.current);
      }

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

    // GSAP은 화면 전환의 존재감을 살짝 주는 정도로만 사용합니다.
    // Figma 레이아웃 자체가 중요한 프로토타입이므로 큰 움직임은 피합니다.
    const { transitions } = prototypeParams;
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
          duration: transitions.pageTransitionEnterDuration,
          ease: transitions.pageTransitionEase,
          overwrite: "auto",
          transformOrigin: "50% 50%",
          onComplete: () => {
            isTransitioningRef.current = false;
            gsap.set(screenElement, {
              clearProps: "opacity,visibility,transform",
            });
          },
        },
      );
    }, screenRef);

    return () => context.revert();
  }, [screen]);

  const addComment = (body: string) => {
    setComments((currentComments) => {
      const nextComment: CommentItem = {
        id: `local-${Date.now()}`,
        author: "나",
        role: "프로토타입 의견",
        time: "방금 전",
        position: getNextCommentPosition(currentComments),
        avatarType: "initials",
        initials: "나",
        isOwnedByCurrentUser: true,
        body,
      };

      return [...currentComments, nextComment];
    });
  };

  const stopCommentInertia = () => {
    if (inertiaFrameRef.current !== null) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  };

  const moveComment = (commentId: string, position: CommentPosition) => {
    stopCommentInertia();
    setComments((currentComments) =>
      resolveCommentCollisions(
        currentComments.map((comment) =>
          comment.id === commentId ? { ...comment, position } : comment,
        ),
        commentId,
      ),
    );
  };

  const startCommentInertia = (commentId: string, velocity: CommentVelocity) => {
    stopCommentInertia();

    let velocityX = Math.max(-2.2, Math.min(2.2, velocity.x * 0.9));
    let velocityY = Math.max(-2.2, Math.min(2.2, velocity.y * 0.9));
    let lastTime = performance.now();

    const tick = (time: number) => {
      const elapsed = Math.min(32, time - lastTime);
      lastTime = time;

      setComments((currentComments) => {
        const movedComments = currentComments.map((comment) => {
          if (comment.id !== commentId) {
            return comment;
          }

          const nextPosition = {
            x: comment.position.x + velocityX * elapsed,
            y: comment.position.y + velocityY * elapsed,
          };
          const clampedPosition = clampCommentPosition(nextPosition);

          if (clampedPosition.x !== nextPosition.x) {
            velocityX *= -0.42;
          }

          if (clampedPosition.y !== nextPosition.y) {
            velocityY *= -0.42;
          }

          return {
            ...comment,
            position: clampedPosition,
          };
        });
        const resolvedComments = resolveCommentCollisions(movedComments);
        commentsRef.current = resolvedComments;
        return resolvedComments;
      });

      const damping = Math.pow(0.9, elapsed / 16.67);
      velocityX *= damping;
      velocityY *= damping;

      if (Math.hypot(velocityX, velocityY) > 0.025) {
        inertiaFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      inertiaFrameRef.current = null;
      setComments((currentComments) => {
        const targetComment = currentComments.find((comment) => comment.id === commentId);

        if (!targetComment) {
          return currentComments;
        }

        const finalPosition = resolveNonOverlappingPosition(
          targetComment.position,
          currentComments,
          commentId,
        );

        return resolveCommentCollisions(
          currentComments.map((comment) =>
            comment.id === commentId
              ? { ...comment, position: finalPosition }
              : comment,
          ),
        );
      });
    };

    inertiaFrameRef.current = window.requestAnimationFrame(tick);
  };

  const settleComment = (
    commentId: string,
    position: CommentPosition,
    velocity: CommentVelocity,
  ) => {
    setComments((currentComments) => {
      const resolvedPosition = resolveNonOverlappingPosition(
        position,
        currentComments,
        commentId,
      );

      return currentComments.map((comment) =>
        comment.id === commentId ? { ...comment, position: resolvedPosition } : comment,
      );
    });

    if (Math.hypot(velocity.x, velocity.y) > 0.04) {
      startCommentInertia(commentId, velocity);
    }
  };

  const deleteComment = (commentId: string) => {
    setComments((currentComments) => {
      const targetComment = currentComments.find((comment) => comment.id === commentId);

      if (!targetComment?.isOwnedByCurrentUser) {
        return currentComments;
      }

      return currentComments.filter((comment) => comment.id !== commentId);
    });
  };

  const selectPollOption = (optionId: PollOptionId) => {
    if (isPollSubmitted) {
      return;
    }

    setSelectedPollOption(optionId);
    setIsPollSubmitted(true);
  };

  const sendReaction = (_reactionId: ReactionId) => {
    if (hasIncrementedEmpathyRef.current) {
      return;
    }

    hasIncrementedEmpathyRef.current = true;
    setEmpathyCount((currentCount) => currentCount + 1);
    setHasIncrementedEmpathy(true);
  };

  const goToScreen = useCallback((nextScreen: ScreenId) => {
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

    const { transitions } = prototypeParams;
    isTransitioningRef.current = true;
    gsap.killTweensOf(screenElement);

    gsap.to(screenElement, {
      autoAlpha: 0,
      scale: 0.972,
      y: -12,
      duration: transitions.pageTransitionExitDuration,
      ease: transitions.pageTransitionEase,
      overwrite: "auto",
      transformOrigin: "50% 50%",
      onComplete: () => {
        activeScreenRef.current = nextScreen;
        setScreen(nextScreen);
      },
    });

    return true;
  }, []);

  const goToDetailWithLoading = useCallback(async () => {
    if (
      activeScreenRef.current === "detail" ||
      isTransitioningRef.current ||
      isLoadingOverlayActiveRef.current
    ) {
      return;
    }

    await runLoadingGate(() => preloadVideo(prototypeAssets.storyDetailVideo));
    goToScreen("detail");
  }, [goToScreen, runLoadingGate]);

  return (
    <PrototypeStage
      backgroundSrc={background.src}
      backgroundImageClassName={background.imageClassName}
      backgroundOverlayClassName={background.overlayClassName}
    >
      <div ref={screenRef} className="screen-fill">
        {screen === "landing" ? (
          <LandingScreen onGoToSearch={() => goToScreen("search")} />
        ) : null}

        {screen === "search" || screen === "detail" ? (
          <SearchScreen
            isActive={screen === "search"}
            onOpenStoryDetail={goToDetailWithLoading}
          />
        ) : null}

        {screen === "detail" ? (
          <DetailScreen
            comments={comments}
            empathyCount={empathyCount}
            selectedPollOption={selectedPollOption}
            isPollSubmitted={isPollSubmitted}
            hasIncrementedEmpathy={hasIncrementedEmpathy}
            onBackToSearch={() => goToScreen("search")}
            onSelectPollOption={selectPollOption}
            onSendReaction={sendReaction}
            onAddComment={addComment}
            onMoveComment={moveComment}
            onSettleComment={settleComment}
            onDeleteComment={deleteComment}
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
