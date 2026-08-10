import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  pollOptions,
  prototypeText,
  type PollOptionId,
} from "../../data/prototypeContent";
import { createGlassStyle, prototypeParams, toRgba } from "../../config/prototypeParams";
import { AnimatedButton } from "./AnimatedButton";

const TOP_RESULT_HIGHLIGHT = {
  borderColor: "rgba(92, 178, 255, 0.95)",
  fillColor: "rgba(0, 108, 255, 0.58)",
  backgroundColor: "rgba(0, 44, 95, 0.50)",
  boxShadow:
    "0 0 24px rgba(0, 108, 255, 0.48), inset 0 0 0 1px rgba(255,255,255,0.32), inset 0 0 0 2px rgba(92,178,255,0.35)",
} as const;

type PollCardProps = {
  selectedOption: PollOptionId | null;
  isSubmitted: boolean;
  onSelectOption: (optionId: PollOptionId) => void;
};

export function PollCard({
  selectedOption,
  isSubmitted,
  onSelectOption,
}: PollCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const resultFillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lastTopResultAnimationKeyRef = useRef("");
  const page3Glass = prototypeParams.page3.glass;
  const page3Motion = prototypeParams.page3.motion;
  const pollCardStyle = createGlassStyle(page3Glass.pollCard);
  const pollOptionStyle = createGlassStyle(page3Glass.pollOption);
  const topResultPercent = Math.max(...pollOptions.map((option) => option.resultPercent));
  const topResultAnimationKey = pollOptions
    .filter((option) => option.resultPercent === topResultPercent)
    .map((option) => option.id)
    .join("|");
  const selectedResultOptionStyle = {
    ...pollOptionStyle,
    borderColor: toRgba("#ffffff", 0.78),
  };
  const topResultOptionStyle = {
    ...pollOptionStyle,
    backgroundColor: TOP_RESULT_HIGHLIGHT.backgroundColor,
    borderColor: TOP_RESULT_HIGHLIGHT.borderColor,
    boxShadow: TOP_RESULT_HIGHLIGHT.boxShadow,
  };

  useLayoutEffect(() => {
    const cardElement = cardRef.current;

    if (!cardElement) {
      return;
    }

    const enterTween = gsap.fromTo(
      cardElement,
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        delay: page3Motion.pollEnterDelay,
        duration: page3Motion.pollEnterDuration,
        ease: page3Motion.pollEnterEase,
        force3D: true,
        overwrite: "auto",
        onComplete: () => {
          gsap.set(cardElement, { clearProps: "transform" });
        },
      },
    );

    return () => {
      enterTween.kill();
    };
  }, [
    page3Motion.pollEnterDelay,
    page3Motion.pollEnterDuration,
    page3Motion.pollEnterEase,
  ]);

  useEffect(() => {
    const resultFills = resultFillRefs.current.filter(Boolean) as HTMLSpanElement[];
    const cardElement = cardRef.current;
    const topResultButtons = cardElement
      ? Array.from(cardElement.querySelectorAll<HTMLElement>('[data-top-result="true"]'))
      : [];

    gsap.killTweensOf(resultFills);
    gsap.killTweensOf(topResultButtons);

    if (!isSubmitted) {
      lastTopResultAnimationKeyRef.current = "";
      resultFills.forEach((fillElement) => {
        gsap.set(fillElement, { opacity: 0, width: "0%" });
      });
      return undefined;
    }

    const resultTweens = pollOptions
      .map((option, index) => {
        const fillElement = resultFillRefs.current[index];

        if (!fillElement) {
          return null;
        }

        const isTopResult = option.resultPercent === topResultPercent;

        gsap.set(fillElement, { opacity: isTopResult ? 0 : 1, width: "0%" });

        return gsap.to(fillElement, {
          opacity: 1,
          width: `${option.resultPercent}%`,
          delay: index * 0.12,
          duration: 0.72,
          ease: "power3.out",
          overwrite: "auto",
        });
      })
      .filter(Boolean) as gsap.core.Tween[];

    const highlightTweens =
      lastTopResultAnimationKeyRef.current === topResultAnimationKey
        ? []
        : topResultButtons.flatMap((button) => [
            gsap.fromTo(
              button,
              {
                boxShadow:
                  "0 0 0 rgba(0, 108, 255, 0), inset 0 0 0 1px rgba(255,255,255,0)",
                scale: 1,
              },
              {
                boxShadow: TOP_RESULT_HIGHLIGHT.boxShadow,
                duration: 0.45,
                ease: "power3.out",
                overwrite: "auto",
              },
            ),
            gsap.fromTo(
              button,
              { scale: 1 },
              {
                scale: 1.035,
                duration: 0.2,
                ease: "power2.out",
                yoyo: true,
                repeat: 1,
                overwrite: "auto",
                transformOrigin: "50% 50%",
              },
            ),
          ]);

    if (topResultButtons.length > 0) {
      lastTopResultAnimationKeyRef.current = topResultAnimationKey;
    }

    return () => {
      resultTweens.forEach((tween) => tween.kill());
      highlightTweens.forEach((tween) => tween.kill());
    };
  }, [isSubmitted, selectedOption, topResultAnimationKey, topResultPercent]);

  return (
    <section
      ref={cardRef}
      className="gui-scale gui-origin-bottom-right page3-poll-card absolute bottom-[calc(var(--viewport-height)-var(--safe-bottom)+28px)] left-[max(var(--safe-left),calc(var(--safe-right)-439px))] flex max-h-[calc(var(--safe-bottom)-var(--safe-top)-148px)] w-[439px] max-w-[calc(var(--viewport-width)-32px)] flex-col gap-[14px] overflow-x-hidden overflow-y-auto rounded-[24px] border px-[20px] py-[20px] text-white"
      style={pollCardStyle}
      data-node-id="15:34"
      data-name="poll/poll-card - child-in-car"
      aria-label="투표 카드"
    >
      <div className="flex w-full flex-col gap-[4px]" data-name="poll/header">
        <h2 className="text-[20px] font-bold leading-[24px] tracking-[-0.4px] [overflow-wrap:anywhere] [word-break:keep-all]">
          좋은 부모란 무엇일까요?
        </h2>
        <p className="text-[14px] font-medium leading-[20px] tracking-[-0.14px] text-white/90 [overflow-wrap:anywhere] [word-break:keep-all]">
          {prototypeText.pollQuestion}
        </p>
      </div>

      <div className="flex min-h-0 w-full flex-col gap-[10px]" data-name="poll/body">
        <p className="text-[16px] font-bold leading-[21px] tracking-[-0.16px] [overflow-wrap:anywhere] [word-break:keep-all]">
          {prototypeText.pollSubQuestion}
        </p>

        <div className="flex w-full flex-col gap-[6px]" data-name="poll/options-list">
          {pollOptions.map((option, index) => {
            const isSelected = selectedOption === option.id;
            const isTopResult = isSubmitted && option.resultPercent === topResultPercent;

            return (
              <AnimatedButton
                key={option.id}
                type="button"
                disabled={isSubmitted}
                onClick={() => onSelectOption(option.id)}
                className={`relative flex min-h-[51px] w-full items-center overflow-hidden rounded-[18px] border px-[16px] py-[8px] text-left text-white transition-colors disabled:cursor-default ${
                  isSubmitted && isSelected && !isTopResult
                    ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                    : ""
                }`}
                style={
                  isTopResult
                    ? topResultOptionStyle
                    : isSubmitted && isSelected
                      ? selectedResultOptionStyle
                      : pollOptionStyle
                }
                data-name={`poll/option-0${index + 1}`}
                data-result-percent={option.resultPercent}
                data-top-result={isTopResult ? "true" : undefined}
                aria-pressed={isSelected}
              >
                {isSubmitted ? (
                  <span
                    ref={(element) => {
                      resultFillRefs.current[index] = element;
                    }}
                    className={`pointer-events-none absolute inset-y-0 left-0 rounded-[inherit] ${
                      isTopResult ? "" : isSelected ? "bg-white/55" : "bg-white/40"
                    }`}
                    style={isTopResult ? { backgroundColor: TOP_RESULT_HIGHLIGHT.fillColor } : undefined}
                    aria-hidden="true"
                  />
                ) : null}

                <span
                  className={`relative z-10 min-w-0 flex-1 font-medium [overflow-wrap:anywhere] [word-break:keep-all] ${
                    isTopResult
                      ? "text-[20px] leading-[25px] tracking-[-0.2px]"
                      : "text-[16px] leading-[20px] tracking-[-0.16px]"
                  }`}
                >
                  {option.label}
                </span>

                {isSubmitted ? (
                  <span
                    className={`relative z-10 ml-[12px] shrink-0 text-right font-medium ${
                      isTopResult
                        ? "w-[52px] text-[20px] leading-[24px] tracking-[-0.6px]"
                        : "w-[42px] text-[16px] leading-[19px] tracking-[-0.48px]"
                    }`}
                  >
                    {option.resultPercent}%
                  </span>
                ) : null}
              </AnimatedButton>
            );
          })}
        </div>
      </div>
    </section>
  );
}
