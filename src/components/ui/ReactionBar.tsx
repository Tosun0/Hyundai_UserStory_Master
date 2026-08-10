import { gsap } from "gsap";
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createGlassStyle, prototypeParams } from "../../config/prototypeParams";
import { reactions, type ReactionId } from "../../data/prototypeContent";
import { AnimatedButton } from "./AnimatedButton";

type ReactionBarProps = {
  onSendReaction?: (reactionId: ReactionId) => void;
};

type FloatingReaction = {
  id: string;
  emoji: string;
  left: number;
  drift: number;
  distance: number;
};

function FloatingReactionItem({
  item,
  onDone,
}: {
  item: FloatingReaction;
  onDone: (id: string) => void;
}) {
  const itemRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!itemRef.current) {
      return;
    }

    const motion = prototypeParams.page3.reactionMotion;
    const tween = gsap.fromTo(
      itemRef.current,
      { y: 0, x: 0, scale: 1, opacity: 1, rotate: motion.startRotate },
      {
        y: -item.distance,
        x: item.drift,
        scale: motion.scaleTo,
        opacity: 0,
        rotate: motion.endRotate,
        duration: motion.duration,
        ease: "power2.out",
        onComplete: () => onDone(item.id),
      },
    );

    return () => {
      tween.kill();
    };
  }, [item.id, onDone]);

  return (
    <span
      ref={itemRef}
      className="pointer-events-none absolute bottom-[38px] z-20 block -translate-x-1/2 font-['Inter',sans-serif] text-[30px] leading-none"
      style={{ left: item.left }}
      data-name="reaction/floating-emoji"
      aria-hidden="true"
    >
      {item.emoji}
    </span>
  );
}

export function ReactionBar({ onSendReaction }: ReactionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const page3Glass = prototypeParams.page3.glass;
  const reactionBarStyle = createGlassStyle(page3Glass.reactionBar);
  const reactionButtonStyle = createGlassStyle(page3Glass.reactionButton);

  const removeFloatingReaction = useCallback((id: string) => {
    setFloatingReactions((items) => items.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current !== null) {
        window.clearInterval(holdIntervalRef.current);
      }
    };
  }, []);

  const sendReactionFromButton = (
    buttonElement: HTMLButtonElement,
    reactionId: ReactionId,
    emoji: string,
  ) => {
    onSendReaction?.(reactionId);

    const buttonRect = buttonElement.getBoundingClientRect();
    const barRect = barRef.current?.getBoundingClientRect();
    const left = barRect
      ? buttonRect.left - barRect.left + buttonRect.width / 2
      : buttonRect.width / 2;
    const motion = prototypeParams.page3.reactionMotion;
    const distance =
      motion.minDistance + Math.random() * (motion.maxDistance - motion.minDistance);
    const drift = Math.random() * motion.maxDrift * 2 - motion.maxDrift;

    setFloatingReactions((items) => [
      ...items,
      {
        id: `${reactionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        emoji,
        left,
        drift,
        distance,
      },
    ]);
  };

  const stopHoldReaction = () => {
    if (holdIntervalRef.current === null) {
      return;
    }

    window.clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
  };

  const startHoldReaction = (
    event: PointerEvent<HTMLButtonElement>,
    reactionId: ReactionId,
    emoji: string,
  ) => {
    stopHoldReaction();

    const buttonElement = event.currentTarget;
    const motion = prototypeParams.page3.reactionMotion;
    const intervalMs = 1000 / motion.holdFireRatePerSecond;

    sendReactionFromButton(buttonElement, reactionId, emoji);
    holdIntervalRef.current = window.setInterval(() => {
      sendReactionFromButton(buttonElement, reactionId, emoji);
    }, intervalMs);
  };

  return (
    <div
      ref={barRef}
      className="gui-scale gui-origin-bottom-center page3-reaction-bar absolute left-[var(--viewport-center-x)] top-[calc(var(--safe-bottom)-76px-28px)] flex h-[76px] w-[406px] max-w-[calc(var(--viewport-width)-32px)] -translate-x-1/2 gap-[6px] rounded-full border p-[6px]"
      style={reactionBarStyle}
      data-node-id="15:16"
      data-name="reaction/reaction-bar"
    >
      {floatingReactions.map((item) => (
        <FloatingReactionItem
          key={item.id}
          item={item}
          onDone={removeFloatingReaction}
        />
      ))}

      {reactions.map((reaction) => (
        <AnimatedButton
          key={reaction.id}
          type="button"
          aria-label={`${reaction.emoji} 반응 보내기`}
          title={`${reaction.emoji} 반응 보내기`}
          onPointerDown={(event) =>
            startHoldReaction(event, reaction.id, reaction.emoji)
          }
          onPointerUp={stopHoldReaction}
          onPointerLeave={stopHoldReaction}
          onPointerCancel={stopHoldReaction}
          className="relative z-10 flex h-[64px] w-[74px] items-center justify-center rounded-[40.23px]"
          style={reactionButtonStyle}
          data-name={reaction.figmaName}
        >
          <span className="font-['Inter',sans-serif] text-[22px] leading-[16px] text-[#1447e6]">
            {reaction.emoji}
          </span>
        </AnimatedButton>
      ))}
    </div>
  );
}
