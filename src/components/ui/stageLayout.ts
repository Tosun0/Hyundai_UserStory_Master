import type { CSSProperties } from "react";

export type StageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Figma의 1920 x 1080 좌표를 그대로 코드에 적기 위한 도우미입니다.
// 화면 전체는 PrototypeStage에서 스케일되므로 여기 값은 Figma 픽셀 그대로 유지합니다.
export function rectStyle(rect: StageRect): CSSProperties {
  return {
    position: "absolute",
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

