import {
  createGlassStyle,
  prototypeParams,
  type CssVariableStyle,
} from "../../config/prototypeParams";
import { prototypeAssets, type CommentItem } from "../../data/prototypeContent";
import { AnimatedButton } from "./AnimatedButton";

// 댓글 카드의 Glass blur 강도입니다.
// 여기 숫자를 바꾸면 기본 상태와 등장 애니메이션의 최종 blur가 같이 바뀝니다.
type CommentCardProps = {
  comment: CommentItem;
  className?: string;
  nodeId?: string;
  dataName?: string;
  onDelete?: () => void;
};

export function CommentCard({
  comment,
  className = "",
  nodeId,
  dataName,
  onDelete,
}: CommentCardProps) {
  const commentCardGlass = prototypeParams.page3.glass.commentCard;
  const deleteButtonGlass = prototypeParams.page3.glass.commentDeleteButton;
  const glassStyle = {
    ...createGlassStyle(commentCardGlass, {
      blurCssVariable: "--comment-card-glass-blur",
    }),
    "--comment-card-glass-blur": `${commentCardGlass.blur}px`,
  } as CssVariableStyle;
  const deleteButtonStyle = createGlassStyle(deleteButtonGlass);

  return (
    <article
      className={`gui-scale gui-origin-top-left comment-card-glass relative flex h-[119.57px] w-[472px] max-w-[calc(var(--viewport-width)-36px)] select-none gap-[21.94px] overflow-hidden rounded-[24px] border-2 p-[18.29px] text-white ${className}`}
      style={glassStyle}
      data-node-id={nodeId}
      data-name={dataName}
    >
      {onDelete ? (
        <AnimatedButton
          type="button"
          aria-label={`${comment.author} 댓글 삭제`}
          title="댓글 삭제"
          onClick={onDelete}
          className="absolute right-[10px] top-[8px] z-10 flex h-[24px] w-[24px] items-center justify-center rounded-full text-[16px] leading-none text-white"
          style={deleteButtonStyle}
          data-comment-action="delete"
          hoverScale={1.12}
          pressScale={0.86}
        >
          ×
        </AnimatedButton>
      ) : null}

      {comment.avatarType === "image" ? (
        <div className="h-[40px] w-[40px] shrink-0 overflow-hidden rounded-full bg-[#c8e1f5]">
          <img
            src={prototypeAssets.engineerAvatar}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#fae9e5] text-[14px] font-bold tracking-[-0.42px] text-[#b1432c]">
          {comment.initials}
        </div>
      )}

      <div className="min-w-0 flex-1 pr-[34px]">
        <div className="mb-[4px] flex items-center justify-between whitespace-nowrap">
          <div className="flex items-baseline gap-[7px]">
            <strong className="text-[16px] leading-none tracking-[-0.48px]">
              {comment.author}
            </strong>
            <span className="text-[14px] leading-none tracking-[-0.42px] text-white/40">
              {comment.role}
            </span>
          </div>
          <time className="text-[14px] leading-none tracking-[-0.42px] text-[#e4e4e4]">
            {comment.time}
          </time>
        </div>
        <p className="line-clamp-3 text-[14px] leading-[20px] tracking-[-0.42px]">
          {comment.body}
        </p>
      </div>
    </article>
  );
}
