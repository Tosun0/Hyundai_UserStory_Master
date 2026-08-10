import type { CSSProperties } from "react";

/**
 * 이 파일은 프로토타입에서 사람이 직접 자주 만질 수 있는 값을 모아둔 곳입니다.
 * 코드 구조를 잘 모르더라도 이 파일의 숫자만 바꾸면 Page3의 유리 질감과 움직임을 조절할 수 있습니다.
 */

export type GlassSurfaceParams = {
  /** blur가 높을수록 뒤 배경이 더 많이 흐려집니다. 단위는 px입니다. */
  blur: number;
  /** 유리판 자체의 색입니다. 대부분 Figma의 회색/검정/흰색을 그대로 씁니다. */
  backgroundColor: string;
  /** 유리판 색의 투명도입니다. 0은 완전 투명, 1은 완전 불투명입니다. */
  backgroundAlpha: number;
  /** 테두리 색입니다. */
  borderColor: string;
  /** 테두리 투명도입니다. 0은 안 보이고, 1은 선명하게 보입니다. */
  borderAlpha: number;
  /** 필요할 때만 쓰는 옵션입니다. 100보다 크면 뒤 배경 색이 조금 더 진해집니다. */
  saturation?: number;
};

type GlassStyleOptions = {
  /**
   * GSAP이 blur 값을 애니메이션해야 하는 경우 CSS 변수를 사용합니다.
   * 예: "--comment-card-glass-blur"
   */
  blurCssVariable?: `--${string}`;
};

export type CssVariableStyle = CSSProperties & Record<`--${string}`, string | number>;

const colors = {
  white: "#ffffff",
  black: "#000000",
  darkButton: "#2c2c2d",
  darkOption: "#353535",
  glassGray: "#c4c4c4",
} as const;

export const prototypeParams = {
  loading: {
    minimumDurationMs: 500,
    overlayFadeDuration: 0.18,
  },
  transitions: {
    /** 화면이 새로 들어올 때 걸리는 시간입니다. 초 단위입니다. */
    pageTransitionEnterDuration: 0.46,
    /** 기존 화면이 나갈 때 걸리는 시간입니다. 초 단위입니다. */
    pageTransitionExitDuration: 0.28,
    /** 화면과 배경 전환에 함께 쓰는 GSAP ease 값입니다. */
    pageTransitionEase: "power2.out",
    /** 배경 이미지가 서로 겹쳐 바뀌는 시간입니다. 초 단위입니다. */
    backgroundCrossfadeDuration: 0.52,
  },
  page3: {
    glass: {
      commentCard: {
        blur: 100,
        backgroundColor: colors.glassGray,
        backgroundAlpha: 0.2,
        borderColor: colors.white,
        borderAlpha: 0.05,
      },
      commentDeleteButton: {
        blur: 12,
        backgroundColor: colors.black,
        backgroundAlpha: 0.45,
        borderColor: colors.white,
        borderAlpha: 0,
      },
      pollCard: {
        blur: 100,
        backgroundColor: colors.glassGray,
        backgroundAlpha: 0.3,
        borderColor: colors.white,
        borderAlpha: 0.05,
      },
      pollOption: {
        blur: 18.286,
        backgroundColor: colors.darkOption,
        backgroundAlpha: 0.4,
        borderColor: colors.white,
        borderAlpha: 0.2,
      },
      pollSubmitButton: {
        blur: 18.286,
        backgroundColor: colors.darkOption,
        backgroundAlpha: 1,
        borderColor: colors.white,
        borderAlpha: 0,
      },
      pollSubmitDoneButton: {
        blur: 18.286,
        backgroundColor: colors.darkOption,
        backgroundAlpha: 0.46,
        borderColor: colors.white,
        borderAlpha: 0.12,
      },
      reactionBar: {
        blur: 70,
        backgroundColor: colors.white,
        backgroundAlpha: 0.3,
        borderColor: colors.white,
        borderAlpha: 0.05,
      },
      reactionButton: {
        blur: 18.286,
        backgroundColor: colors.darkButton,
        backgroundAlpha: 1,
        borderColor: colors.white,
        borderAlpha: 0,
      },
      commentInput: {
        blur: 70,
        backgroundColor: colors.glassGray,
        backgroundAlpha: 0.22,
        borderColor: colors.white,
        borderAlpha: 0.2,
      },
      commentSendButton: {
        blur: 18.29,
        backgroundColor: colors.darkButton,
        backgroundAlpha: 1,
        borderColor: colors.white,
        borderAlpha: 0,
      },
      iconButton: {
        blur: 18.286,
        backgroundColor: colors.darkButton,
        backgroundAlpha: 1,
        borderColor: colors.white,
        borderAlpha: 0.5,
      },
      iconButtonActive: {
        blur: 18.286,
        backgroundColor: colors.white,
        backgroundAlpha: 1,
        borderColor: colors.white,
        borderAlpha: 0.5,
      },
    },
    motion: {
      /** 댓글 카드가 처음 나타날 때 시작 scale입니다. 0이면 점처럼 작게 시작합니다. */
      commentEnterScaleFrom: 0,
      /** 댓글 카드 등장 시간입니다. 초 단위입니다. */
      commentEnterDuration: 0.22,
      /** 댓글 카드 삭제 시간입니다. 초 단위입니다. */
      commentExitDuration: 0.4,
      /** 댓글 카드 등장/삭제의 GSAP ease 값입니다. */
      commentEnterEase: "back.out(1.55)",
      commentExitEase: "back.in(1.35)",
      /** 투표 카드는 Page3 진입 후 약간 기다렸다가 등장하도록 지연 시간을 둡니다. */
      pollEnterDelay: 0.5,
      /** 투표 카드가 scale 0에서 1로 커지는 시간입니다. */
      pollEnterDuration: 0.22,
      /** 투표 완료 상태를 보여준 뒤 카드가 사라지기 전까지 기다리는 시간입니다. */
      pollExitDelay: 0.2,
      /** 투표 카드가 scale 1에서 0으로 줄어드는 시간입니다. */
      pollExitDuration: 0.32,
      /** 투표 카드 등장/퇴장에 사용하는 GSAP ease 값입니다. */
      pollEnterEase: "back.out(1.45)",
      pollExitEase: "back.in(1.2)",
    },
    reactionMotion: {
      /** 이모지가 위로 날아가는 시간입니다. 초 단위입니다. */
      duration: 1.8,
      /** 이모지가 올라가는 최소/최대 거리입니다. 단위는 px입니다. */
      minDistance: 180,
      maxDistance: 260,
      /** 이모지가 좌우로 살짝 흩어지는 최대 거리입니다. 단위는 px입니다. */
      maxDrift: 14,
      /** 이모지가 사라지기 전 커지는 배율입니다. */
      scaleTo: 2.4,
      /** 반응 버튼을 꾹 누를 때 초당 발사되는 이모지 개수입니다. */
      holdFireRatePerSecond: 10,
      startRotate: -4,
      endRotate: 10,
    },
  },
} as const;

function clampAlpha(alpha: number) {
  return Math.min(1, Math.max(0, alpha));
}

export function toRgba(hexColor: string, alpha: number) {
  const normalizedHex = hexColor.replace("#", "");
  const expandedHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : normalizedHex;
  const colorNumber = Number.parseInt(expandedHex, 16);
  const red = (colorNumber >> 16) & 255;
  const green = (colorNumber >> 8) & 255;
  const blue = colorNumber & 255;

  return `rgb(${red} ${green} ${blue} / ${clampAlpha(alpha)})`;
}

export function createGlassStyle(
  glass: GlassSurfaceParams,
  options: GlassStyleOptions = {},
): CSSProperties {
  const blurValue = options.blurCssVariable
    ? `var(${options.blurCssVariable}, ${glass.blur}px)`
    : `${glass.blur}px`;
  const backdropFilter = `blur(${blurValue})${
    glass.saturation ? ` saturate(${glass.saturation}%)` : ""
  }`;

  return {
    backgroundColor: toRgba(glass.backgroundColor, glass.backgroundAlpha),
    borderColor: toRgba(glass.borderColor, glass.borderAlpha),
    backdropFilter,
    WebkitBackdropFilter: backdropFilter,
  };
}
