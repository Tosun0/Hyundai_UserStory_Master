import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { createGlassStyle, prototypeParams } from "../../config/prototypeParams";
import {
  prototypeAssets,
  prototypeText,
  type CommentItem,
  type PollOptionId,
  type ReactionId,
} from "../../data/prototypeContent";
import type { CommentPosition, CommentVelocity } from "../../utils/commentLayout";
import { AnimatedButton } from "../ui/AnimatedButton";
import { ArrowGlyph } from "../ui/ArrowGlyph";
import { DraggableCommentCard } from "../ui/DraggableCommentCard";
import { GlassIconButton } from "../ui/GlassIconButton";
import { PollCard } from "../ui/PollCard";
import { ReactionBar } from "../ui/ReactionBar";

gsap.registerPlugin(Observer);

const STORY_EXTRA_ACTION_URL = "https://carousel-eta-silk.vercel.app/";
const STORY_SCROLL_RELEASE_DELTA = 340;
const STORY_SCROLL_RESISTANCE_Y = 34;
const STORY_SCROLL_RESET_DELAY_MS = 140;
const STORY_EXTRA_SCROLL_RELEASE_DELTA = 220;
const STORY_EXTRA_SCROLL_TRIGGER_DELTA = 110;
const STORY_EXTRA_SCROLL_RESISTANCE_Y = 26;
const STORY_CHOICE_REVEAL_DELAY_MS = 260;

type StoryIntroPhase = "video" | "choice" | "revealed";
type StoryChoiceId = "A" | "B";
type StoryHudState = "initial" | "dropped";

const STORY_CHOICE_OPTIONS: Array<{
  id: StoryChoiceId;
  label: string;
  defaultSrc: string;
  selectSrc: string;
}> = [
  {
    id: "A",
    label: "내일은 아이와 시간을 보내기 위해 일정을 조정한다.",
    defaultSrc: prototypeAssets.storySelectorButtonADefault,
    selectSrc: prototypeAssets.storySelectorButtonASelect,
  },
  {
    id: "B",
    label: "지금 프로젝트를 우선하고 주말을 기약한다",
    defaultSrc: prototypeAssets.storySelectorButtonBDefault,
    selectSrc: prototypeAssets.storySelectorButtonBSelect,
  },
];

const STORY_HUD_IMAGE_SRC: Record<StoryHudState, string> = {
  initial: prototypeAssets.storySelectorHudBefore,
  dropped: prototypeAssets.storySelectorHudAfter,
};

type DetailScreenProps = {
  comments: CommentItem[];
  empathyCount: number;
  selectedPollOption: PollOptionId | null;
  isPollSubmitted: boolean;
  hasIncrementedEmpathy: boolean;
  onBackToSearch: () => void;
  onSelectPollOption: (optionId: PollOptionId) => void;
  onSendReaction: (reactionId: ReactionId) => void;
  onAddComment: (body: string) => void;
  onMoveComment: (commentId: string, position: CommentPosition) => void;
  onSettleComment: (
    commentId: string,
    position: CommentPosition,
    velocity: CommentVelocity,
  ) => void;
  onDeleteComment: (commentId: string) => void;
};

type SlotMachineNumberProps = {
  value: number;
  shouldAnimate: boolean;
};

function SlotMachineNumber({ value, shouldAnimate }: SlotMachineNumberProps) {
  const currentRef = useRef<HTMLSpanElement>(null);
  const previousRef = useRef<HTMLSpanElement>(null);
  const previousValueRef = useRef(value);
  const [previousValue, setPreviousValue] = useState(String(value));

  useEffect(() => {
    const previousValueSnapshot = previousValueRef.current;

    if (previousValueSnapshot === value) {
      return;
    }

    setPreviousValue(String(previousValueSnapshot));
    previousValueRef.current = value;

    const currentElement = currentRef.current;
    const previousElement = previousRef.current;

    if (!currentElement || !previousElement || !shouldAnimate) {
      return;
    }

    gsap.killTweensOf([currentElement, previousElement]);
    gsap.set(previousElement, { yPercent: 0, opacity: 1 });
    gsap.set(currentElement, { yPercent: 105, opacity: 0 });

    const timeline = gsap.timeline();

    timeline
      .to(previousElement, {
        yPercent: -105,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
      })
      .to(
        currentElement,
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.55,
          ease: "power3.out",
        },
        0,
      );

    return () => {
      timeline.kill();
    };
  }, [shouldAnimate, value]);

  return (
    <span
      className="relative inline-block h-[27px] min-w-[33px] overflow-hidden align-bottom"
      aria-live="polite"
      aria-label={`${value}`}
      data-name="header/empathy-count-slot"
    >
      <span
        ref={previousRef}
        className="story-detail-empathy-previous absolute inset-0 block text-center"
        data-previous-value={previousValue}
        aria-hidden="true"
      />
      <span ref={currentRef} className="absolute inset-0 block text-center">
        {value}
      </span>
    </span>
  );
}

type StoryMomHudProps = {
  state: StoryHudState;
};

function StoryMomHud({ state }: StoryMomHudProps) {
  const hudRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const hud = hudRef.current;

    if (!hud) {
      return;
    }

    const tween = gsap.fromTo(
      hud,
      { autoAlpha: 0, y: -8, "--gui-motion-scale": 0.985 },
      {
        autoAlpha: 1,
        y: 0,
        "--gui-motion-scale": 1,
        duration: 0.34,
        ease: "power3.out",
        overwrite: "auto",
      },
    );

    return () => {
      tween.kill();
    };
  }, [state]);

  return (
    <img
      ref={hudRef}
      className="story-mom-hud"
      data-state={state}
      data-name="story-intro/mom-hud"
      src={STORY_HUD_IMAGE_SRC[state]}
      alt="엄마의 에너지와 아이의 행복도"
      draggable={false}
    />
  );
}

type StoryMissionChoicePanelProps = {
  isResolving: boolean;
  selectedChoice: StoryChoiceId | null;
  onSelect: (choiceId: StoryChoiceId) => void;
};

function StoryMissionChoicePanel({
  isResolving,
  selectedChoice,
  onSelect,
}: StoryMissionChoicePanelProps) {
  const [hoveredChoice, setHoveredChoice] = useState<StoryChoiceId | null>(null);
  const activeChoice = selectedChoice ?? hoveredChoice;

  return (
    <div
      className="story-mission-image-card"
      data-story-scroll-ignore="true"
      data-name="story-intro/mission-choice-card"
      role="group"
      aria-label="스토리 선택지"
    >
      <img
        src={prototypeAssets.storySelectorMissionBox}
        alt=""
        className="story-mission-image-card-asset"
        draggable={false}
      />
      {STORY_CHOICE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`story-selector-choice-button story-selector-choice-button-${option.id.toLowerCase()}`}
          disabled={isResolving}
          onClick={() => onSelect(option.id)}
          onPointerEnter={() => setHoveredChoice(option.id)}
          onPointerLeave={() =>
            setHoveredChoice((currentChoice) =>
              currentChoice === option.id ? null : currentChoice,
            )
          }
          onFocus={() => setHoveredChoice(option.id)}
          onBlur={() =>
            setHoveredChoice((currentChoice) =>
              currentChoice === option.id ? null : currentChoice,
            )
          }
          aria-label={`${option.id} 선택지: ${option.label}`}
          data-name={`story-intro/choice-${option.id}`}
        >
          <img
            src={activeChoice === option.id ? option.selectSrc : option.defaultSrc}
            alt=""
            className="story-selector-choice-button-asset"
            draggable={false}
          />
        </button>
      ))}
    </div>
  );
}

export function DetailScreen({
  comments,
  empathyCount,
  selectedPollOption,
  isPollSubmitted,
  hasIncrementedEmpathy,
  onBackToSearch,
  onSelectPollOption,
  onSendReaction,
  onAddComment,
  onMoveComment,
  onSettleComment,
  onDeleteComment,
}: DetailScreenProps) {
  const [commentDraft, setCommentDraft] = useState("");
  const [areCommentsVisible, setAreCommentsVisible] = useState(true);
  const [introPhase, setIntroPhase] = useState<StoryIntroPhase>("video");
  const [selectedIntroChoice, setSelectedIntroChoice] = useState<StoryChoiceId | null>(
    null,
  );
  const [isExtraFrameTransitionActive, setIsExtraFrameTransitionActive] =
    useState(false);
  const scrollShellRef = useRef<HTMLDivElement>(null);
  const firstSectionRef = useRef<HTMLDivElement>(null);
  const extraFrameTransitionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const choiceOverlayRef = useRef<HTMLDivElement>(null);
  const communityLayerRef = useRef<HTMLDivElement>(null);
  const isChoiceResolvingRef = useRef(false);
  const choiceRevealTimerRef = useRef<number | null>(null);
  const page3Glass = prototypeParams.page3.glass;
  const commentInputStyle = createGlassStyle(page3Glass.commentInput);
  const commentSendButtonStyle = createGlassStyle(page3Glass.commentSendButton);
  const storyActionButtonStyle = createGlassStyle(page3Glass.iconButton);
  const commentToggleLabel = areCommentsVisible ? "댓글 숨기기" : "댓글 보이기";
  const isCommunityUnlocked = introPhase === "revealed";
  const shouldRenderComments = isCommunityUnlocked && areCommentsVisible;
  const hudState: StoryHudState = isCommunityUnlocked ? "dropped" : "initial";

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    let isCancelled = false;

    const revealChoice = () => {
      if (isCancelled) {
        return;
      }

      setIntroPhase((currentPhase) =>
        currentPhase === "video" ? "choice" : currentPhase,
      );
    };

    const playVideo = () => {
      if (isCancelled) {
        return;
      }

      const playPromise = video.play();

      if (playPromise) {
        playPromise.catch(() => undefined);
      }
    };

    const handleLoadedData = () => playVideo();

    video.currentTime = 0;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("ended", revealChoice);
    video.addEventListener("error", revealChoice);

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.load();
    }

    return () => {
      isCancelled = true;
      video.pause();
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("ended", revealChoice);
      video.removeEventListener("error", revealChoice);
    };
  }, []);

  useEffect(() => {
    const choiceOverlay = choiceOverlayRef.current;

    if (introPhase !== "choice" || !choiceOverlay) {
      return;
    }

    isChoiceResolvingRef.current = false;

    const tween = gsap.fromTo(
      choiceOverlay,
      { autoAlpha: 0, y: 18, scale: 0.982 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.42,
        ease: "power3.out",
        overwrite: "auto",
      },
    );

    return () => {
      tween.kill();
    };
  }, [introPhase]);

  useEffect(() => {
    const communityLayer = communityLayerRef.current;

    if (!isCommunityUnlocked || !communityLayer) {
      return;
    }

    const tween = gsap.fromTo(
      communityLayer,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.48,
        ease: "power3.out",
        overwrite: "auto",
      },
    );

    return () => {
      tween.kill();
    };
  }, [isCommunityUnlocked]);

  useEffect(() => {
    return () => {
      if (choiceRevealTimerRef.current !== null) {
        window.clearTimeout(choiceRevealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const scrollShell = scrollShellRef.current;
    const transitionFrame = extraFrameTransitionRef.current;

    if (!scrollShell || !transitionFrame) {
      return;
    }

    let animationFrame: number | null = null;

    const updateTransitionState = () => {
      animationFrame = null;

      const scrollShellRect = scrollShell.getBoundingClientRect();
      const transitionFrameRect = transitionFrame.getBoundingClientRect();
      const transitionFrameTop =
        scrollShell.scrollTop + transitionFrameRect.top - scrollShellRect.top;
      const triggerOffset = Math.max(
        Math.min(scrollShell.clientHeight, transitionFrame.clientHeight) * 0.16,
        1,
      );
      const shouldActivateTransition =
        scrollShell.scrollTop >= transitionFrameTop + triggerOffset;

      setIsExtraFrameTransitionActive(
        (isActive) => isActive || shouldActivateTransition,
      );
    };

    const requestTransitionStateUpdate = () => {
      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(updateTransitionState);
    };

    updateTransitionState();
    scrollShell.addEventListener("scroll", requestTransitionStateUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestTransitionStateUpdate);

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      scrollShell.removeEventListener("scroll", requestTransitionStateUpdate);
      window.removeEventListener("resize", requestTransitionStateUpdate);
    };
  }, []);

  useEffect(() => {
    const scrollShell = scrollShellRef.current;
    const firstSection = firstSectionRef.current;

    if (!scrollShell || !firstSection) {
      return;
    }

    if (!isCommunityUnlocked) {
      scrollShell.scrollTop = 0;
      gsap.killTweensOf([scrollShell, firstSection]);
      gsap.set(firstSection, { y: 0 });
      return;
    }

    let isUnlocked = false;
    let isAutoScrolling = false;
    let accumulatedDelta = 0;
    let resetTimer: number | undefined;

    scrollShell.scrollTop = 0;
    gsap.set(firstSection, { y: 0 });

    const resetResistance = () => {
      accumulatedDelta = 0;
      gsap.to(firstSection, {
        y: 0,
        duration: 0.28,
        ease: "elastic.out(1, 0.72)",
        overwrite: "auto",
      });
    };

    const scheduleReset = () => {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(resetResistance, STORY_SCROLL_RESET_DELAY_MS);
    };

    const shouldIgnoreEvent = (event: Event) => {
      if (isAutoScrolling || isUnlocked || scrollShell.scrollTop > 2) {
        return true;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return false;
      }

      return Boolean(
        target.closest(
          ".page3-poll-card, .page3-comment-input, button, a, input, textarea, [data-story-scroll-ignore='true']",
        ),
      );
    };

    const resetScrollResistanceAtTop = () => {
      if (!isUnlocked || isAutoScrolling || scrollShell.scrollTop > 2) {
        return;
      }

      isUnlocked = false;
      accumulatedDelta = 0;
      gsap.killTweensOf(firstSection);
      gsap.set(firstSection, { y: 0 });
      observer.enable();
    };

    const observer = Observer.create({
      target: scrollShell,
      type: "wheel,touch",
      preventDefault: true,
      allowClicks: true,
      tolerance: 1,
      ignoreCheck: shouldIgnoreEvent,
      onChangeY: (self) => {
        if (isUnlocked) {
          return;
        }

        if (self.deltaY <= 0) {
          scheduleReset();
          return;
        }

        window.clearTimeout(resetTimer);
        accumulatedDelta += self.deltaY;

        const progress = Math.min(accumulatedDelta / STORY_SCROLL_RELEASE_DELTA, 1);

        gsap.to(firstSection, {
          y: -STORY_SCROLL_RESISTANCE_Y * progress,
          duration: 0.16,
          ease: "power2.out",
          overwrite: "auto",
        });

        if (accumulatedDelta < STORY_SCROLL_RELEASE_DELTA) {
          scheduleReset();
          return;
        }

        isUnlocked = true;
        isAutoScrolling = true;
        observer.disable();

        gsap.to(firstSection, {
          y: 0,
          duration: 0.48,
          ease: "power3.out",
          overwrite: "auto",
        });

        gsap.to(scrollShell, {
          scrollTop: scrollShell.clientHeight,
          duration: 1.35,
          ease: "power2.inOut",
          overwrite: "auto",
          onComplete: () => {
            isAutoScrolling = false;
          },
        });
      },
    });

    scrollShell.addEventListener("scroll", resetScrollResistanceAtTop, { passive: true });

    return () => {
      window.clearTimeout(resetTimer);
      scrollShell.removeEventListener("scroll", resetScrollResistanceAtTop);
      observer.kill();
      gsap.killTweensOf([scrollShell, firstSection]);
    };
  }, [isCommunityUnlocked]);

  useEffect(() => {
    const scrollShell = scrollShellRef.current;
    const transitionFrame = extraFrameTransitionRef.current;

    if (!isCommunityUnlocked || !scrollShell || !transitionFrame) {
      if (transitionFrame) {
        gsap.killTweensOf(transitionFrame);
        gsap.set(transitionFrame, { y: 0 });
      }

      return;
    }

    let isReleased = false;
    let accumulatedDelta = 0;
    let resetTimer: number | undefined;

    const getTransitionFrameTop = () => {
      const scrollShellRect = scrollShell.getBoundingClientRect();
      const transitionFrameRect = transitionFrame.getBoundingClientRect();
      const transitionFrameY = Number(gsap.getProperty(transitionFrame, "y")) || 0;

      return (
        scrollShell.scrollTop +
        transitionFrameRect.top -
        scrollShellRect.top -
        transitionFrameY
      );
    };

    const resetResistance = () => {
      accumulatedDelta = 0;
      gsap.to(transitionFrame, {
        y: 0,
        duration: 0.28,
        ease: "elastic.out(1, 0.72)",
        overwrite: "auto",
      });
    };

    const scheduleReset = () => {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(
        resetResistance,
        STORY_SCROLL_RESET_DELAY_MS,
      );
    };

    const shouldIgnoreEvent = (event: Event) => {
      if (isReleased) {
        return true;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(
          ".page3-poll-card, .page3-comment-input, button, a, input, textarea, [data-story-scroll-ignore='true']",
        )
      ) {
        return true;
      }

      const distanceFromTransitionTop =
        scrollShell.scrollTop - getTransitionFrameTop();

      return distanceFromTransitionTop < -2 || distanceFromTransitionTop > 3;
    };

    const resetScrollResistanceAtTransitionTop = () => {
      const distanceFromTransitionTop =
        scrollShell.scrollTop - getTransitionFrameTop();

      if (isReleased && distanceFromTransitionTop < -2) {
        isReleased = false;
        accumulatedDelta = 0;
        gsap.killTweensOf(transitionFrame);
        gsap.set(transitionFrame, { y: 0 });
        observer.enable();
        return;
      }

      if (!isReleased && Math.abs(distanceFromTransitionTop) > 3) {
        accumulatedDelta = 0;
        gsap.killTweensOf(transitionFrame);
        gsap.set(transitionFrame, { y: 0 });
      }
    };

    const observer = Observer.create({
      target: scrollShell,
      type: "wheel,touch",
      preventDefault: true,
      allowClicks: true,
      tolerance: 1,
      ignoreCheck: shouldIgnoreEvent,
      onChangeY: (self) => {
        if (isReleased) {
          return;
        }

        if (self.deltaY <= 0) {
          scheduleReset();
          return;
        }

        window.clearTimeout(resetTimer);
        accumulatedDelta += self.deltaY;

        if (accumulatedDelta >= STORY_EXTRA_SCROLL_TRIGGER_DELTA) {
          setIsExtraFrameTransitionActive(true);
        }

        const progress = Math.min(
          accumulatedDelta / STORY_EXTRA_SCROLL_RELEASE_DELTA,
          1,
        );

        gsap.to(transitionFrame, {
          y: -STORY_EXTRA_SCROLL_RESISTANCE_Y * progress,
          duration: 0.16,
          ease: "power2.out",
          overwrite: "auto",
        });

        if (accumulatedDelta < STORY_EXTRA_SCROLL_RELEASE_DELTA) {
          scheduleReset();
          return;
        }

        isReleased = true;
        observer.disable();

        gsap.to(transitionFrame, {
          y: 0,
          duration: 0.42,
          ease: "power3.out",
          overwrite: "auto",
        });
      },
    });

    scrollShell.addEventListener("scroll", resetScrollResistanceAtTransitionTop, {
      passive: true,
    });

    return () => {
      window.clearTimeout(resetTimer);
      scrollShell.removeEventListener("scroll", resetScrollResistanceAtTransitionTop);
      observer.kill();
      gsap.killTweensOf(transitionFrame);
      gsap.set(transitionFrame, { y: 0 });
    };
  }, [isCommunityUnlocked]);

  const selectStoryIntroChoice = (choiceId: StoryChoiceId) => {
    if (introPhase !== "choice" || isChoiceResolvingRef.current) {
      return;
    }

    isChoiceResolvingRef.current = true;
    setSelectedIntroChoice(choiceId);

    const revealCommunity = () => {
      setIntroPhase("revealed");
    };

    if (!choiceOverlayRef.current) {
      choiceRevealTimerRef.current = window.setTimeout(() => {
        choiceRevealTimerRef.current = null;
        revealCommunity();
      }, STORY_CHOICE_REVEAL_DELAY_MS);
      return;
    }

    choiceRevealTimerRef.current = window.setTimeout(() => {
      choiceRevealTimerRef.current = null;

      gsap.to(choiceOverlayRef.current, {
        autoAlpha: 0,
        y: -12,
        scale: 0.98,
        duration: 0.26,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: revealCommunity,
      });
    }, STORY_CHOICE_REVEAL_DELAY_MS);
  };

  const submitComment = () => {
    const trimmed = commentDraft.trim();

    if (!trimmed) {
      return;
    }

    onAddComment(trimmed);
    setCommentDraft("");
  };

  const getCommentMeta = (comment: CommentItem) => {
    if (comment.id === "ux-researcher") {
      return {
        nodeId: "15:66",
        dataName: "comment/comment-card-01-ux-researcher",
      };
    }

    if (comment.id === "engineer") {
      return {
        nodeId: "15:56",
        dataName: "comment/comment-card-02-engineer",
      };
    }

    return {
      dataName: "comment/comment-card-local-demo",
    };
  };

  return (
    <section
      className="screen-fill"
      data-node-id="15:4"
      data-name="03 Screen - Story Detail Community"
    >
      <div
        ref={scrollShellRef}
        className={`story-detail-scroll-shell absolute inset-0 h-[var(--viewport-height)] w-[var(--viewport-width)] overflow-y-auto overscroll-contain ${
          isCommunityUnlocked ? "" : "story-detail-scroll-shell--locked"
        }`}
        data-name="story-detail/scroll-shell"
      >
        <div
          ref={firstSectionRef}
          className="relative min-h-[var(--viewport-height)] w-[var(--viewport-width)] bg-black"
          data-name="story-detail/primary-section"
        >
          <video
            ref={videoRef}
            className="story-detail-video-bg"
            src={prototypeAssets.storyDetailVideo}
            muted
            playsInline
            autoPlay
            preload="auto"
            aria-hidden="true"
            data-name="story-detail/video-background"
          />
          <div
            className="absolute left-0 top-[calc(var(--viewport-height)-285px)] h-[285px] w-[var(--viewport-width)] bg-gradient-to-b from-black/0 to-black"
            data-node-id="15:6"
            data-name="overlay/bottom-gradient-for-comments"
          />
          <div
            className="absolute left-0 top-0 h-[92px] w-[var(--viewport-width)] bg-gradient-to-b from-black/40 to-black/0"
            data-node-id="15:7"
            data-name="overlay/top-header-scrim"
          />

          <AnimatedButton
            type="button"
            onClick={onBackToSearch}
            className="gui-scale gui-origin-top-left absolute left-[calc(var(--safe-left)+28px)] top-[calc(var(--safe-top)+30px)] h-[64px] w-[74px]"
            data-node-id="15:8"
            data-name="nav/back-button"
            aria-label="검색 화면으로 돌아가기"
            title="검색 화면으로 돌아가기"
          >
            <img src={prototypeAssets.backIcon} alt="" className="h-full w-full" />
          </AnimatedButton>

          <header
            className="gui-scale gui-origin-top-center absolute left-[var(--viewport-center-x)] top-[calc(var(--safe-top)+30px)] flex h-[100px] w-[420px] -translate-x-1/2 flex-col items-center text-center text-white"
            data-node-id="15:13"
            data-name="header/story-title-and-stats"
          >
            <h1 className="w-full whitespace-nowrap text-center text-[48px] font-bold leading-[1.25] tracking-[-0.48px]">
              {prototypeText.storyTitle}
            </h1>
            <div className="flex w-full items-center justify-center whitespace-nowrap text-[18px] font-semibold leading-[1.5] tracking-[-0.18px] text-white/80">
              <span>{prototypeText.storyStats}</span>
              <span className="px-[8px] text-white/55" aria-hidden="true">
                |
              </span>
              <span className="inline-flex items-center">
                <span>공감&nbsp;</span>
                <SlotMachineNumber
                  value={empathyCount}
                  shouldAnimate={hasIncrementedEmpathy}
                />
                <span>개</span>
              </span>
            </div>
          </header>

          <div
            className="gui-scale gui-origin-top-right absolute left-[calc(var(--safe-right)-156px)] top-[calc(var(--safe-top)+30px)] flex h-[64px] w-[156px] items-center justify-end gap-[8px]"
            data-node-id="15:27"
            data-name="nav/story-action-buttons"
          >
            <GlassIconButton
              label={isCommunityUnlocked ? commentToggleLabel : "댓글은 선택 이후 표시됩니다"}
              onClick={() => {
                if (!isCommunityUnlocked) {
                  return;
                }

                setAreCommentsVisible((isVisible) => !isVisible);
              }}
              style={storyActionButtonStyle}
              nodeId="15:28"
              dataName="nav/story-action-button-left"
              aria-pressed={isCommunityUnlocked ? !areCommentsVisible : undefined}
              disabled={!isCommunityUnlocked}
              className={isCommunityUnlocked ? "" : "opacity-55"}
            >
              <span
                className="material-symbols-outlined text-[24px] leading-none"
                aria-hidden="true"
              >
                {isCommunityUnlocked && areCommentsVisible
                  ? "visibility"
                  : "visibility_off"}
              </span>
            </GlassIconButton>
            <GlassIconButton
              iconSrc={prototypeAssets.storyActionRightIcon}
              label="공유"
              onClick={() => undefined}
              style={storyActionButtonStyle}
              nodeId="15:31"
              dataName="nav/story-action-button-right"
            />
          </div>

          {isCommunityUnlocked ? (
            <div
              ref={communityLayerRef}
              className="story-community-layer"
              data-name="story-detail/community-layer"
            >
              <PollCard
                selectedOption={selectedPollOption}
                isSubmitted={isPollSubmitted}
                onSelectOption={onSelectPollOption}
              />

              {shouldRenderComments
                ? comments.map((comment) => {
                    const commentMeta = getCommentMeta(comment);
                    const canDeleteComment = comment.isOwnedByCurrentUser === true;

                    return (
                      <DraggableCommentCard
                        key={comment.id}
                        comment={comment}
                        entranceDelay={comment.id.startsWith("local-") ? 0 : 0.28}
                        nodeId={commentMeta.nodeId}
                        dataName={commentMeta.dataName}
                        onMove={onMoveComment}
                        onDragEnd={onSettleComment}
                        onDelete={canDeleteComment ? onDeleteComment : undefined}
                      />
                    );
                  })
                : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitComment();
                }}
                className="gui-scale gui-origin-bottom-left page3-comment-input absolute left-[calc(var(--safe-left)+27px)] top-[calc(var(--safe-bottom)-76px-28px)] flex h-[76px] w-[440px] max-w-[calc(var(--viewport-width)-32px)] items-center overflow-hidden rounded-full border"
                style={commentInputStyle}
                data-node-id="15:77"
                data-name="comment/comment-input"
              >
                <input
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder={prototypeText.commentPlaceholder}
                  className="h-full flex-1 border-0 bg-transparent pl-[30px] pr-[12px] text-[18px] leading-[1.5] tracking-[-0.18px] text-white outline-none placeholder:text-white/70"
                  aria-label="댓글 입력"
                />
                <AnimatedButton
                  type="submit"
                  className="mr-[6px] flex h-[64px] w-[74px] shrink-0 items-center justify-center rounded-full px-[23.77px] py-[7.31px] text-white"
                  style={commentSendButtonStyle}
                  data-node-id="15:79"
                  data-name="comment/send-button"
                  aria-label="댓글 보내기"
                  title="댓글 보내기"
                >
                  <ArrowGlyph />
                </AnimatedButton>
              </form>
            </div>
          ) : null}

          <ReactionBar onSendReaction={onSendReaction} />

          {introPhase !== "video" ? <StoryMomHud state={hudState} /> : null}

          {introPhase === "choice" ? (
            <div
              ref={choiceOverlayRef}
              className="story-choice-overlay"
              data-name="story-intro/choice-overlay"
            >
              <StoryMissionChoicePanel
                isResolving={selectedIntroChoice !== null}
                selectedChoice={selectedIntroChoice}
                onSelect={selectStoryIntroChoice}
              />
            </div>
          ) : null}
        </div>

        <section
          className="relative w-[var(--viewport-width)] bg-white"
          data-name="story-detail/extra-content-section"
        >
          <div
            ref={extraFrameTransitionRef}
            className="story-detail-extra-frame-transition"
            data-name="story-detail/extra-frame-transition"
          >
            <img
              src={prototypeAssets.storyDetailExtraFrame01}
              alt=""
              className="story-detail-extra-frame-image"
              draggable={false}
            />
            <img
              src={prototypeAssets.storyDetailExtraFrame01Scroll}
              alt=""
              className="story-detail-extra-frame-overlay"
              draggable={false}
              data-transition-active={isExtraFrameTransitionActive}
              aria-hidden="true"
            />
          </div>
          <div className="relative w-full">
            <img
              src={prototypeAssets.storyDetailExtraFrame02}
              alt=""
              className="block h-auto w-full select-none"
              draggable={false}
            />
            <a
              href={STORY_EXTRA_ACTION_URL}
              className="story-detail-extra-action-hitarea absolute left-[68.4375%] top-[38.333333%] block h-[22%] w-[9.21875%] rounded-full bg-transparent text-transparent outline-none focus-visible:ring-4 focus-visible:ring-[#2c2c2d]/30"
              data-name="story-detail/extra-action-link"
              aria-label="바로가기"
              title="바로가기"
            >
              바로가기
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
