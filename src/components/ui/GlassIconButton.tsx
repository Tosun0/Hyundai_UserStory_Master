import type { ButtonHTMLAttributes } from "react";
import { AnimatedButton } from "./AnimatedButton";

type GlassIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  iconSrc?: string;
  label: string;
  variant?: "dark" | "light";
  nodeId?: string;
  dataName?: string;
};

export function GlassIconButton({
  iconSrc,
  label,
  variant = "dark",
  nodeId,
  dataName,
  className = "",
  children,
  style,
  ...buttonProps
}: GlassIconButtonProps) {
  const hasCustomBackdrop = Boolean(style?.backdropFilter || style?.WebkitBackdropFilter);
  const variantClass =
    variant === "light"
      ? "bg-white text-[#2c2c2d]"
      : "border border-white/50 bg-[#2c2c2d] text-white";

  return (
    <AnimatedButton
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-[64px] w-[74px] items-center justify-center rounded-[40.23px] px-[20px] py-[12px] ${hasCustomBackdrop ? "" : "backdrop-blur-[18.286px]"} ${variantClass} ${className}`}
      style={style}
      data-node-id={nodeId}
      data-name={dataName}
      {...buttonProps}
    >
      {iconSrc ? <img src={iconSrc} alt="" className="h-[24px] w-[24px]" /> : children}
    </AnimatedButton>
  );
}
