import type { CommentItem } from "../data/prototypeContent";
import { getCurrentGuiScale } from "./guiScale";

export type CommentPosition = CommentItem["position"];
export type CommentVelocity = {
  x: number;
  y: number;
};

export const COMMENT_CARD_WIDTH = 472;
export const COMMENT_CARD_HEIGHT = 120;
const COLLISION_GAP = 18;
const SAFE_MARGIN = 18;
const TOP_SAFE_MARGIN = 112;
const STAGE_SAFE_MARGIN = 16;
const COMMENT_INPUT_HEIGHT = 76;
const COMMENT_INPUT_DESKTOP_LEFT_OFFSET = 27;
const COMMENT_INPUT_DESKTOP_BOTTOM_GAP = 28;
const COMMENT_INPUT_MOBILE_BOTTOM_GAP = 16;
const REACTION_BAR_MOBILE_BOTTOM_GAP = 108;
const INITIAL_COMMENT_STACK_GAP = 14;
const MOBILE_COMMENT_LAYOUT_BREAKPOINT = 900;

function getViewportBounds() {
  if (typeof window === "undefined") {
    return {
      width: 1920,
      height: 1080,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getCommentCardWidth() {
  const viewport = getViewportBounds();
  const guiScale = getCurrentGuiScale();

  return (
    Math.min(COMMENT_CARD_WIDTH, Math.max(240, viewport.width - SAFE_MARGIN * 2)) *
    guiScale
  );
}

function getCommentCardHeight() {
  return COMMENT_CARD_HEIGHT * getCurrentGuiScale();
}

const COMMENT_SLOTS: CommentPosition[] = [
  { x: 528, y: 440 },
  { x: 81, y: 683 },
  { x: 528, y: 584 },
  { x: 81, y: 530 },
  { x: 982, y: 440 },
  { x: 982, y: 584 },
  { x: 528, y: 728 },
  { x: 81, y: 386 },
  { x: 982, y: 728 },
];

export function getInitialCommentStackPositions(count: number) {
  const viewport = getViewportBounds();
  const isMobile = viewport.width <= MOBILE_COMMENT_LAYOUT_BREAKPOINT;
  const guiScale = getCurrentGuiScale();
  const commentCardHeight = getCommentCardHeight();
  const inputHeight = COMMENT_INPUT_HEIGHT * guiScale;
  const stackGap = INITIAL_COMMENT_STACK_GAP * guiScale;
  const safeBottom = viewport.height - STAGE_SAFE_MARGIN;
  const inputLeft = isMobile ? STAGE_SAFE_MARGIN : STAGE_SAFE_MARGIN + COMMENT_INPUT_DESKTOP_LEFT_OFFSET;
  const inputTop =
    safeBottom -
    inputHeight -
    (isMobile ? COMMENT_INPUT_MOBILE_BOTTOM_GAP : COMMENT_INPUT_DESKTOP_BOTTOM_GAP);
  const stackAnchorTop = isMobile
    ? safeBottom - inputHeight - REACTION_BAR_MOBILE_BOTTOM_GAP
    : inputTop;

  return Array.from({ length: count }, (_, index) => ({
    x: inputLeft,
    y:
      stackAnchorTop -
      stackGap -
      commentCardHeight -
      (count - index - 1) * (commentCardHeight + stackGap),
  }));
}

export function clampCommentPosition(position: CommentPosition): CommentPosition {
  const viewport = getViewportBounds();
  const commentCardWidth = getCommentCardWidth();
  const commentCardHeight = getCommentCardHeight();
  const maxX = Math.max(SAFE_MARGIN, viewport.width - commentCardWidth - SAFE_MARGIN);
  const maxY = Math.max(
    TOP_SAFE_MARGIN,
    viewport.height - commentCardHeight - SAFE_MARGIN,
  );

  return {
    x: Math.max(SAFE_MARGIN, Math.min(position.x, maxX)),
    y: Math.max(TOP_SAFE_MARGIN, Math.min(position.y, maxY)),
  };
}

function overlaps(a: CommentPosition, b: CommentPosition) {
  const commentCardWidth = getCommentCardWidth();
  const commentCardHeight = getCommentCardHeight();

  return !(
    a.x + commentCardWidth + COLLISION_GAP < b.x ||
    b.x + commentCardWidth + COLLISION_GAP < a.x ||
    a.y + commentCardHeight + COLLISION_GAP < b.y ||
    b.y + commentCardHeight + COLLISION_GAP < a.y
  );
}

function hasCollision(
  position: CommentPosition,
  comments: CommentItem[],
  movingCommentId?: string,
) {
  return comments.some((comment) => {
    if (comment.id === movingCommentId) {
      return false;
    }

    return overlaps(position, comment.position);
  });
}

export function getNextCommentPosition(comments: CommentItem[]) {
  const availableSlot = COMMENT_SLOTS.find((slot) => !hasCollision(slot, comments));

  if (availableSlot) {
    return availableSlot;
  }

  return resolveNonOverlappingPosition({ x: 528, y: 584 }, comments);
}

export function resolveCommentCollisions(
  comments: CommentItem[],
  lockedCommentId?: string,
) {
  let nextComments = comments.map((comment) => ({
    ...comment,
    position: clampCommentPosition(comment.position),
  }));

  for (let iteration = 0; iteration < 8; iteration += 1) {
    let changed = false;

    for (let aIndex = 0; aIndex < nextComments.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < nextComments.length; bIndex += 1) {
        const a = nextComments[aIndex];
        const b = nextComments[bIndex];

        if (!overlaps(a.position, b.position)) {
          continue;
        }

        const commentCardWidth = getCommentCardWidth();
        const commentCardHeight = getCommentCardHeight();
        const centerA = {
          x: a.position.x + commentCardWidth / 2,
          y: a.position.y + commentCardHeight / 2,
        };
        const centerB = {
          x: b.position.x + commentCardWidth / 2,
          y: b.position.y + commentCardHeight / 2,
        };
        const overlapX =
          commentCardWidth + COLLISION_GAP - Math.abs(centerA.x - centerB.x);
        const overlapY =
          commentCardHeight + COLLISION_GAP - Math.abs(centerA.y - centerB.y);
        const directionX = centerA.x <= centerB.x ? -1 : 1;
        const directionY = centerA.y <= centerB.y ? -1 : 1;

        const moveA = { x: 0, y: 0 };
        const moveB = { x: 0, y: 0 };

        if (overlapX < overlapY) {
          const push = overlapX / 2;
          moveA.x = directionX * push;
          moveB.x = -directionX * push;
        } else {
          const push = overlapY / 2;
          moveA.y = directionY * push;
          moveB.y = -directionY * push;
        }

        if (a.id === lockedCommentId) {
          moveB.x *= 2;
          moveB.y *= 2;
          moveA.x = 0;
          moveA.y = 0;
        }

        if (b.id === lockedCommentId) {
          moveA.x *= 2;
          moveA.y *= 2;
          moveB.x = 0;
          moveB.y = 0;
        }

        nextComments = nextComments.map((comment) => {
          if (comment.id === a.id) {
            return {
              ...comment,
              position: clampCommentPosition({
                x: comment.position.x + moveA.x,
                y: comment.position.y + moveA.y,
              }),
            };
          }

          if (comment.id === b.id) {
            return {
              ...comment,
              position: clampCommentPosition({
                x: comment.position.x + moveB.x,
                y: comment.position.y + moveB.y,
              }),
            };
          }

          return comment;
        });
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return nextComments;
}

export function resolveNonOverlappingPosition(
  requestedPosition: CommentPosition,
  comments: CommentItem[],
  movingCommentId?: string,
) {
  const clampedRequestedPosition = clampCommentPosition(requestedPosition);

  if (!hasCollision(clampedRequestedPosition, comments, movingCommentId)) {
    return clampedRequestedPosition;
  }

  const candidates: CommentPosition[] = [];
  const step = 32;
  const maxDistance = 640;

  for (let radius = step; radius <= maxDistance; radius += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      candidates.push(clampCommentPosition({ x: requestedPosition.x + dx, y: requestedPosition.y - radius }));
      candidates.push(clampCommentPosition({ x: requestedPosition.x + dx, y: requestedPosition.y + radius }));
    }
    for (let dy = -radius + step; dy <= radius - step; dy += step) {
      candidates.push(clampCommentPosition({ x: requestedPosition.x - radius, y: requestedPosition.y + dy }));
      candidates.push(clampCommentPosition({ x: requestedPosition.x + radius, y: requestedPosition.y + dy }));
    }
  }

  candidates.sort((a, b) => {
    const distanceA = Math.hypot(a.x - clampedRequestedPosition.x, a.y - clampedRequestedPosition.y);
    const distanceB = Math.hypot(b.x - clampedRequestedPosition.x, b.y - clampedRequestedPosition.y);
    return distanceA - distanceB;
  });

  return (
    candidates.find((candidate) => !hasCollision(candidate, comments, movingCommentId)) ??
    clampedRequestedPosition
  );
}
