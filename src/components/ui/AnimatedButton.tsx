import { gsap } from "gsap";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useRef,
} from "react";

type AnimatedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  hoverScale?: number;
  pressScale?: number;
};

type AnimatedButtonStyle = CSSProperties &
  Record<"--gui-motion-scale", number>;

export function AnimatedButton({
  children,
  className = "",
  disabled,
  hoverScale = 1.045,
  pressScale = 0.94,
  type = "button",
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  style,
  ...buttonProps
}: AnimatedButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const animateTo = useCallback((scale: number, duration = 0.22) => {
    if (!buttonRef.current) {
      return;
    }

    gsap.to(buttonRef.current, {
      "--gui-motion-scale": scale,
      duration,
      ease: scale === 1 ? "elastic.out(1, 0.45)" : "power2.out",
      overwrite: "auto",
    });
  }, []);

  const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      animateTo(hoverScale, 0.18);
    }
    onPointerEnter?.(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      animateTo(1, 0.34);
    }
    onPointerLeave?.(event);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      animateTo(pressScale, 0.12);
    }
    onPointerDown?.(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      animateTo(hoverScale, 0.18);
    }
    onPointerUp?.(event);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      animateTo(1, 0.24);
    }
    onPointerCancel?.(event);
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      className={`animated-button ${className}`}
      style={{ "--gui-motion-scale": 1, ...style } as AnimatedButtonStyle}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
