import { gsap } from "gsap";
import { type PointerEvent, useEffect, useLayoutEffect, useRef } from "react";
import { prototypeParams } from "../../config/prototypeParams";
import type { CommentItem } from "../../data/prototypeContent";
import {
  clampCommentPosition,
  type CommentPosition,
  type CommentVelocity,
} from "../../utils/commentLayout";
import { CommentCard } from "./CommentCard";

type DraggableCommentCardProps = {
  comment: CommentItem;
  entranceDelay?: number;
  onMove: (commentId: string, position: CommentPosition) => void;
  onDragEnd: (
    commentId: string,
    position: CommentPosition,
    velocity: CommentVelocity,
  ) => void;
  onDelete?: (commentId: string) => void;
  nodeId?: string;
  dataName?: string;
};

export function DraggableCommentCard({
  comment,
  entranceDelay = 0,
  onMove,
  onDragEnd,
  onDelete,
  nodeId,
  dataName,
}: DraggableCommentCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const motionLayerRef = useRef<HTMLDivElement>(null);
  const isDeletingRef = useRef(false);
  const latestPositionRef = useRef(comment.position);
  const latestSampleRef = useRef({
    time: 0,
    position: comment.position,
  });
  const latestVelocityRef = useRef<CommentVelocity>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    latestPositionRef.current = comment.position;
  }, [comment.position]);

  useLayoutEffect(() => {
    if (!motionLayerRef.current) {
      return;
    }

    const { motion } = prototypeParams.page3;
    const motionLayer = motionLayerRef.current;
    const tween = gsap.fromTo(
      motionLayer,
      {
        scale: motion.commentEnterScaleFrom,
      },
      {
        scale: 1,
        delay: entranceDelay,
        duration: motion.commentEnterDuration,
        ease: motion.commentEnterEase,
        transformOrigin: "50% 50%",
        force3D: true,
        onComplete: () => {
          gsap.set(motionLayer, {
            clearProps: "transform",
          });
        },
      },
    );

    return () => {
      tween.kill();
    };
  }, []);

  const handleDelete = () => {
    if (!motionLayerRef.current || isDeletingRef.current || !onDelete) {
      return;
    }

    isDeletingRef.current = true;
    dragStateRef.current = null;

    gsap.to(motionLayerRef.current, {
      scale: 0,
      duration: prototypeParams.page3.motion.commentExitDuration,
      ease: prototypeParams.page3.motion.commentExitEase,
      transformOrigin: "50% 50%",
      overwrite: "auto",
      onComplete: () => onDelete(comment.id),
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (isDeletingRef.current || target.closest("[data-comment-action]")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: comment.position.x,
      startY: comment.position.y,
    };
    latestSampleRef.current = {
      time: performance.now(),
      position: comment.position,
    };
    latestVelocityRef.current = { x: 0, y: 0 };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampCommentPosition({
      x: dragState.startX + event.clientX - dragState.startClientX,
      y: dragState.startY + event.clientY - dragState.startClientY,
    });
    const now = performance.now();
    const lastSample = latestSampleRef.current;
    const elapsed = Math.max(1, now - lastSample.time);

    latestVelocityRef.current = {
      x: (nextPosition.x - lastSample.position.x) / elapsed,
      y: (nextPosition.y - lastSample.position.y) / elapsed,
    };
    latestSampleRef.current = {
      time: now,
      position: nextPosition,
    };

    onMove(comment.id, nextPosition);
    latestPositionRef.current = nextPosition;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    onDragEnd(comment.id, latestPositionRef.current, latestVelocityRef.current);
  };

  return (
    <div
      ref={wrapperRef}
      className="absolute touch-none cursor-grab active:cursor-grabbing"
      style={{ left: comment.position.x, top: comment.position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div ref={motionLayerRef}>
        <CommentCard
          comment={comment}
          nodeId={nodeId}
          dataName={dataName}
          onDelete={onDelete ? handleDelete : undefined}
        />
      </div>
    </div>
  );
}
