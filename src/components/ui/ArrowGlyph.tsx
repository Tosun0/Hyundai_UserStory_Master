type ArrowGlyphProps = {
  className?: string;
};

export function ArrowGlyph({ className = "" }: ArrowGlyphProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-[24px] w-[38px] items-center justify-center ${className}`}
    >
      {/* Figma에서는 위쪽 화살표를 90도 돌려 오른쪽 진행 방향으로 사용했습니다. */}
      <span className="block rotate-90 text-[25.6px] leading-[1.5] tracking-[-0.256px]">
        ↑
      </span>
    </span>
  );
}

