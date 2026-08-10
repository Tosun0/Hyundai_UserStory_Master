import { gsap } from "gsap";
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  aiChatSortConfig,
  type AiChatSortStage,
} from "../../data/aiChatSortConfig";
import type { PlaybookFilter } from "../../data/playbookCatalog";
import { AnimatedButton } from "../ui/AnimatedButton";

type AiChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  status: "done" | "thinking" | "typing";
};

const AXIS_INDEX_TOGGLE_COMMAND = "\uC778\uB371\uC2A4";
const STORY_DETAIL_COMMAND = "\uC2A4\uD1A0\uB9AC";

type AiChatSortPanelProps = {
  onSortStageComplete: (stage: AiChatSortStage, filter?: PlaybookFilter) => void;
  onToggleAxisIndexes?: () => void;
  onOpenStoryDetailCommand?: () => void;
};

function AiSparkleIcon() {
  return (
    <svg
      className="h-[24px] w-[24px] shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#8d93aa"
        d="M14.6 3.8l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9 1.9-5.1z"
      />
      <path
        fill="#8d93aa"
        d="M5.9 1.9l.9 2.4 2.4.9-2.4.9-.9 2.4L5 6.1l-2.4-.9L5 4.3l.9-2.4z"
      />
    </svg>
  );
}

function ThinkingDotsAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const animation: AnimationItem = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: aiChatSortConfig.thinkingAnimationSrc,
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
    });

    return () => {
      animation.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[24px] w-[60px]"
      aria-label="AI thinking"
    />
  );
}

function ChatBubble({ message }: { message: AiChatMessage }) {
  const isAi = message.role === "ai";

  return (
    <div
      className={`flex w-full ${isAi ? "justify-start" : "justify-end"}`}
      data-name={isAi ? "bubble_ai_area" : "bubble_user_area"}
    >
      <div
        className={
          isAi
            ? "flex min-w-[150px] max-w-full items-center justify-start gap-[4px] rounded-br-[24px] rounded-tl-[24px] rounded-tr-[24px] border border-[rgba(212,212,212,0.9)] bg-[rgba(219,219,219,0.9)] px-[20px] py-[16px] backdrop-blur-[20px]"
            : "flex w-fit max-w-full flex-col items-center rounded-bl-[24px] rounded-tl-[24px] rounded-tr-[24px] border border-[rgba(255,255,255,0.9)] bg-[rgba(255,255,255,0.8)] px-[20px] py-[16px] backdrop-blur-[50px]"
        }
        data-name={isAi ? "chat bubble_ai" : "chat bubble"}
      >
        {isAi ? <AiSparkleIcon /> : null}
        {message.status === "thinking" ? (
          <ThinkingDotsAnimation />
        ) : (
          <p
            className={`flex min-h-[24px] w-full items-center break-words text-[16px] font-medium leading-[1.5] tracking-[-0.16px] ${
              isAi ? "min-w-px flex-1 text-[#1c1c1c]" : "text-[#2c2c2d]"
            }`}
          >
            {message.text}
            {message.status === "typing" ? (
              <span className="ml-[2px] inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-[#1c1c1c]" />
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}

export function AiChatSortPanel({
  onSortStageComplete,
  onToggleAxisIndexes,
  onOpenStoryDetailCommand,
}: AiChatSortPanelProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [completedStages, setCompletedStages] = useState(0);
  const [isResponding, setIsResponding] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const draftMessageRef = useRef<HTMLDivElement>(null);
  const animatedMessageIdsRef = useRef(new Set<string>());
  const isDraftMessageAnimatedRef = useRef(false);
  const previousMessagesBottomRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delayMs: number) => {
    const timerId = window.setTimeout(callback, delayMs);
    timersRef.current.push(timerId);
  };

  const isDraftMessageVisible =
    inputValue.trim().length > 0 &&
    !isResponding &&
    completedStages < aiChatSortConfig.aiReplies.length;

  useLayoutEffect(() => {
    if (!panelRef.current) {
      return;
    }

    const tween = gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0, y: 26, scale: 0.985 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.46,
        ease: "power3.out",
        transformOrigin: "100% 100%",
      },
    );

    return () => {
      tween.kill();
    };
  }, []);

  useLayoutEffect(() => {
    const newMessageElements = messages
      .filter((message) => !animatedMessageIdsRef.current.has(message.id))
      .map((message) => {
        animatedMessageIdsRef.current.add(message.id);
        return messageRefs.current.get(message.id);
      })
      .filter(Boolean) as HTMLDivElement[];

    if (!isDraftMessageVisible) {
      isDraftMessageAnimatedRef.current = false;
    }

    if (
      isDraftMessageVisible &&
      draftMessageRef.current &&
      !isDraftMessageAnimatedRef.current
    ) {
      newMessageElements.push(draftMessageRef.current);
      isDraftMessageAnimatedRef.current = true;
    }

    const messagesContainer = messagesContainerRef.current;
    const previousBottom = previousMessagesBottomRef.current;

    if (messagesContainer && previousBottom !== null) {
      const currentBottom = messagesContainer.getBoundingClientRect().bottom;
      const deltaY = previousBottom - currentBottom;

      if (Math.abs(deltaY) > 0.5) {
        gsap.fromTo(
          messagesContainer,
          { y: deltaY },
          {
            y: 0,
            duration: 0.64,
            ease: "power3.out",
            overwrite: "auto",
          },
        );
      }
    }

    if (newMessageElements.length === 0) {
      previousMessagesBottomRef.current =
        messagesContainerRef.current?.getBoundingClientRect().bottom ?? null;
      return;
    }

    gsap.fromTo(
      newMessageElements,
      { autoAlpha: 0, y: 18, scale: 0.965 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "back.out(1.28)",
        overwrite: "auto",
        transformOrigin: "50% 100%",
        stagger: 0.06,
      },
    );

    previousMessagesBottomRef.current =
      messagesContainerRef.current?.getBoundingClientRect().bottom ?? null;
  }, [isDraftMessageVisible, messages.length]);

  useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }, [isDraftMessageVisible, messages]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!isResponding && completedStages < aiChatSortConfig.aiReplies.length) {
      inputRef.current?.focus();
    }
  }, [completedStages, isResponding]);

  const typeAiReply = (messageId: string, reply: string, stage: AiChatSortStage) => {
    const characters = Array.from(reply);

    const typeNextCharacter = (index: number) => {
      const nextText = characters.slice(0, index + 1).join("");

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                text: nextText,
                status: index === characters.length - 1 ? "done" : "typing",
              }
            : message,
        ),
      );

      if (index >= characters.length - 1) {
        setIsResponding(false);
        setCompletedStages(stage);
        onSortStageComplete(stage);
        window.requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      const typedCharacter = characters[index];
      const delay =
        typedCharacter === "." || typedCharacter === "?" || typedCharacter === "!"
          ? aiChatSortConfig.punctuationPauseMs
          : aiChatSortConfig.typingIntervalMs;

      schedule(() => typeNextCharacter(index + 1), delay);
    };

    typeNextCharacter(0);
  };

  const submitMessage = (messageText: string) => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage || isResponding) {
      return;
    }

    if (trimmedMessage === AXIS_INDEX_TOGGLE_COMMAND) {
      setInputValue("");
      onToggleAxisIndexes?.();
      return;
    }

    if (trimmedMessage === STORY_DETAIL_COMMAND) {
      setInputValue("");
      onOpenStoryDetailCommand?.();
      return;
    }

    if (trimmedMessage.toUpperCase() === "GN8") {
      const userMessageId = `user-${Date.now()}`;
      const aiMessageId = `ai-${Date.now()}`;

      clearTimers();
      setInputValue("");
      setIsResponding(false);
      setCompletedStages(aiChatSortConfig.aiReplies.length);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: userMessageId,
          role: "user",
          text: trimmedMessage,
          status: "done",
        },
        {
          id: aiMessageId,
          role: "ai",
          text: "GN8 플레이북 4개를 찾았습니다.",
          status: "done",
        },
      ]);
      onSortStageComplete(3, "GN8");
      return;
    }

    if (completedStages >= aiChatSortConfig.aiReplies.length) {
      return;
    }

    clearTimers();
    const nextStage = (completedStages + 1) as AiChatSortStage;
    const userMessageId = `user-${Date.now()}`;
    const aiMessageId = `ai-${Date.now()}`;
    const reply = aiChatSortConfig.aiReplies[nextStage - 1];

    setInputValue("");
    setIsResponding(true);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: userMessageId,
        role: "user",
        text: trimmedMessage,
        status: "done",
      },
    ]);

    schedule(() => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: aiMessageId,
          role: "ai",
          text: "",
          status: "thinking",
        },
      ]);

      schedule(() => {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === aiMessageId
              ? {
                  ...message,
                  text: "",
                  status: "typing",
                }
              : message,
          ),
        );
        typeAiReply(aiMessageId, reply, nextStage);
      }, aiChatSortConfig.thinkingDurationMs);
    }, aiChatSortConfig.aiResponseDelayMs);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage(inputValue);
  };

  const isComplete = completedStages >= aiChatSortConfig.aiReplies.length;
  const trimmedInputValue = inputValue.trim();
  const isIndexCommand = trimmedInputValue === AXIS_INDEX_TOGGLE_COMMAND;
  const isStoryDetailCommand = trimmedInputValue === STORY_DETAIL_COMMAND;
  const isInputDisabled = isResponding;
  const isSubmitDisabled =
    isResponding || !trimmedInputValue || (isComplete && !isIndexCommand && !isStoryDetailCommand);
  const hasQuickPrompts = aiChatSortConfig.quickPrompts.length > 0;

  return (
    <div
      className="gui-scale gui-origin-bottom-right ai-chat-sort-shell pointer-events-auto"
      data-name="ai_search"
    >
      <div
        ref={panelRef}
        className="ai-chat-sort-panel flex w-full flex-col justify-end gap-[41px] py-[10px]"
      >
        <div
          className="ai-chat-sort-messages flex w-full flex-col justify-end gap-[12px] overflow-y-auto px-[20px]"
          data-name="chat area"
          aria-live="polite"
        >
          <div ref={messagesContainerRef} className="flex w-full flex-col justify-end gap-[12px] py-[18px]">
            {messages.map((message) => (
              <div
                key={message.id}
                ref={(element) => {
                  if (element) {
                    messageRefs.current.set(message.id, element);
                  } else {
                    messageRefs.current.delete(message.id);
                  }
                }}
              >
                <ChatBubble message={message} />
              </div>
            ))}
            {isDraftMessageVisible ? (
              <div ref={draftMessageRef}>
                <ChatBubble
                  message={{
                    id: "draft-user-thinking",
                    role: "user",
                    text: "",
                    status: "thinking",
                  }}
                />
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full shrink-0 flex-col items-start gap-[18px] rounded-[40.229px] border-2 border-[rgba(255,255,255,0.05)] bg-[rgba(196,196,196,0.2)] p-[18.286px] backdrop-blur-[25px]"
          data-name="search panel"
        >
          <div className="flex w-full shrink-0 items-center gap-[12px]" data-name="search-row">
            <label
              className="flex min-w-0 flex-1 shrink items-start justify-center rounded-[24px] bg-[rgba(255,255,255,0.5)] px-[20px] py-[16px] backdrop-blur-[20px]"
              data-name="search bar"
            >
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                disabled={isInputDisabled}
                placeholder={
                  isComplete ? "최종 큐브를 선택하세요." : aiChatSortConfig.inputPlaceholder
                }
                className="h-[30px] w-full border-0 bg-transparent text-[20px] leading-[1.5] tracking-[-0.2px] text-[#2c2c2d] outline-none placeholder:text-[#5b5b5b] disabled:cursor-default"
                aria-label="AI chat sorting message"
              />
            </label>
            <AnimatedButton
              type="submit"
              disabled={isSubmitDisabled}
              className="flex h-[54px] w-[85.54px] shrink-0 items-center justify-center rounded-full bg-[#2c2c2d] px-[23.771px] py-[7.314px] text-white backdrop-blur-[9.143px] disabled:cursor-default disabled:opacity-45"
              data-name="button_enter"
              aria-label="Send message"
              title="Send message"
            >
              <span className="block text-[25.6px] leading-[1.5] tracking-[-0.256px]">→</span>
            </AnimatedButton>
          </div>

          {hasQuickPrompts ? (
            <div className="flex w-full shrink-0 items-center gap-[10.971px]" data-name="layout">
              {aiChatSortConfig.quickPrompts.map((prompt) => (
                <AnimatedButton
                  key={prompt}
                  type="button"
                  disabled={isInputDisabled}
                  onClick={() => setInputValue(prompt)}
                  className="flex h-[54px] shrink-0 items-center justify-center rounded-full bg-black/40 px-[22px] py-[8px] text-[20px] font-medium leading-[1.5] tracking-[-0.2px] text-white backdrop-blur-[9.143px] disabled:cursor-default disabled:opacity-50"
                  data-name="button_dummy"
                >
                  {prompt}
                </AnimatedButton>
              ))}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
