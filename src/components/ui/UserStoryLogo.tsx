type UserStoryLogoProps = {
  className?: string;
  shadowClassName?: string;
  nodeId?: string;
  width?: number;
  height?: number;
};

export function UserStoryLogo({
  className = "",
  shadowClassName = "drop-shadow-[0_4px_18.35px_rgba(0,0,0,0.7)]",
  nodeId,
  width = 133,
  height = 63,
}: UserStoryLogoProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center text-white ${shadowClassName} ${className}`}
      style={{ width, height }}
      data-node-id={nodeId}
      data-name="brand/logo-component - User Story MI Platform"
      aria-label="User Story MI Platform"
    >
      <span className="block whitespace-nowrap text-[54px] font-semibold leading-[0.98] tracking-[-1.08px]">
        User Story
      </span>
      <span className="mt-[12px] block whitespace-nowrap text-[38px] font-medium leading-[1] tracking-[-0.38px]">
        MI Platform
      </span>
    </div>
  );
}
