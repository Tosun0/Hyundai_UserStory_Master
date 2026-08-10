import type { CSSProperties } from "react";

type MinimalCubeLoaderProps = {
  variant?: "scene" | "fullscreen";
  isExiting?: boolean;
  dataName?: string;
  style?: CSSProperties;
};

export function MinimalCubeLoader({
  variant = "scene",
  isExiting = false,
  dataName = "loading/minimal-cube-loader",
  style,
}: MinimalCubeLoaderProps) {
  return (
    <div
      className={`minimal-cube-loader minimal-cube-loader--${variant} ${
        isExiting ? "minimal-cube-loader--exiting" : ""
      }`}
      data-name={dataName}
      aria-hidden="true"
      style={style}
    >
      <div className="minimal-cube-loader__icon">
        <span className="material-symbols-outlined minimal-cube-loader__symbol">
          deployed_code
        </span>
      </div>
      <div className="minimal-cube-loader__track">
        <span />
      </div>
    </div>
  );
}
