import { type FormEvent, useEffect, useRef, useState } from "react";
import type { PlaybookAccessGroup } from "../../data/playbookCatalog";
import { prototypeText } from "../../data/prototypeContent";
import { AnimatedButton } from "../ui/AnimatedButton";
import { ArrowGlyph } from "../ui/ArrowGlyph";
import { UserStoryLogo } from "../ui/UserStoryLogo";

type LandingScreenProps = {
  onGoToSearch: (group: PlaybookAccessGroup, isPasswordTosun: boolean) => void;
};

type AccessVerificationResponse = {
  group?: PlaybookAccessGroup;
  isPasswordTosun?: boolean;
};

function isPlaybookAccessGroup(value: unknown): value is PlaybookAccessGroup {
  return value === "ALL" || value === "H" || value === "GN8";
}

export function LandingScreen({ onGoToSearch }: LandingScreenProps) {
  const [isCodePromptVisible, setIsCodePromptVisible] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [hasCodeError, setHasCodeError] = useState(false);
  const [isAccessCodeVisible, setIsAccessCodeVisible] = useState(false);
  const [isVerifyingAccessCode, setIsVerifyingAccessCode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCodePromptVisible) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isCodePromptVisible]);

  const showCodePrompt = () => {
    setIsCodePromptVisible(true);
    setHasCodeError(false);
  };

  const submitAccessCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessCode.trim() || isVerifyingAccessCode) {
      return;
    }

    setIsVerifyingAccessCode(true);

    try {
      const response = await fetch("/api/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });
      const result = (await response.json()) as AccessVerificationResponse;

      if (!response.ok || !isPlaybookAccessGroup(result.group)) {
        throw new Error("Access code verification failed");
      }

      setHasCodeError(false);
      onGoToSearch(result.group, result.isPasswordTosun === true);
    } catch {
      setHasCodeError(true);
      inputRef.current?.focus();
    } finally {
      setIsVerifyingAccessCode(false);
    }
  };

  return (
    <section
      className="screen-fill"
      data-node-id="15:123"
      data-name="01 Screen - Landing Intro (시작 화면)"
    >
      <UserStoryLogo
        className="gui-scale gui-origin-center absolute left-[calc(var(--viewport-center-x)-210px)] top-[calc(var(--viewport-center-y)-110px)]"
        nodeId="15:160"
        width={420}
        height={118}
      />

      <AnimatedButton
        type="button"
        onClick={showCodePrompt}
        className="gui-scale gui-origin-center absolute left-[calc(var(--viewport-center-x)-63.27px)] top-[calc(var(--viewport-center-y)+41px)] flex h-[54px] w-[126.54px] items-center justify-center gap-[4px] rounded-full bg-[#2c2c2d] px-[23.77px] py-[7.31px] text-[25.6px] leading-[1.5] tracking-[-0.256px] text-white backdrop-blur-[18.29px]"
        data-node-id="15:128"
        data-name="action/go-to-cube-view-button"
      >
        <span>{prototypeText.landingButton}</span>
        <ArrowGlyph />
      </AnimatedButton>

      {isCodePromptVisible ? (
        <form
          onSubmit={submitAccessCode}
          className="gui-scale gui-origin-top-center absolute left-[var(--viewport-center-x)] top-[calc(var(--viewport-center-y)+112px)] flex w-[320px] max-w-[calc(var(--viewport-width)-32px)] -translate-x-1/2 flex-col items-center gap-[8px]"
          data-name="landing/access-code-panel"
        >
          <div className="flex h-[58px] w-full items-center gap-[8px] rounded-full border border-white/30 bg-white/25 p-[6px] shadow-[0_18px_48px_rgba(0,0,0,0.12)] backdrop-blur-[35px]">
            <label className="sr-only" htmlFor="landing-access-code">
              Access code
            </label>
            <div className="relative h-full min-w-0 flex-1">
              <input
                ref={inputRef}
                id="landing-access-code"
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(event.target.value);
                  setHasCodeError(false);
                }}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Access code"
                disabled={isVerifyingAccessCode}
                className={`landing-access-code-input ${
                  isAccessCodeVisible ? "" : "landing-access-code-input--masked"
                } h-full w-full rounded-full border-0 bg-white/75 pl-[20px] pr-[52px] text-[18px] font-medium leading-[1.5] tracking-[-0.18px] text-[#2c2c2d] outline-none placeholder:text-[#5b5b5b]`}
                aria-invalid={hasCodeError}
                aria-describedby={hasCodeError ? "landing-access-code-error" : undefined}
              />
              <AnimatedButton
                type="button"
                onClick={() => setIsAccessCodeVisible((isVisible) => !isVisible)}
                className="absolute right-[8px] top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full text-[#2c2c2d]"
                data-name="landing/access-code-visibility-toggle"
                aria-label={isAccessCodeVisible ? "Hide access code" : "Show access code"}
                title={isAccessCodeVisible ? "Hide access code" : "Show access code"}
              >
                <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">
                  {isAccessCodeVisible ? "visibility_off" : "visibility"}
                </span>
              </AnimatedButton>
            </div>
            <AnimatedButton
              type="submit"
              className="flex h-[46px] w-[58px] shrink-0 items-center justify-center rounded-full bg-[#2c2c2d] text-white disabled:opacity-45"
              disabled={!accessCode.trim() || isVerifyingAccessCode}
              data-name="landing/access-code-submit"
              aria-label="Submit access code"
              title="Submit access code"
            >
              <ArrowGlyph />
            </AnimatedButton>
          </div>
          {hasCodeError ? (
            <p
              id="landing-access-code-error"
              className="rounded-full bg-[#2c2c2d]/85 px-[16px] py-[7px] text-center text-[14px] font-semibold leading-[1.4] tracking-[-0.14px] text-white backdrop-blur-[18px]"
              data-name="landing/access-code-error"
            >
              잘못된 코드입니다.
            </p>
          ) : null}
        </form>
      ) : null}

      <div
        className="gui-scale gui-origin-bottom-center absolute bottom-[56px] left-[var(--viewport-center-x)] flex h-[16px] -translate-x-1/2 items-center"
        data-node-id="1897:863"
        data-name="brand/landing-bottom-hyundai-kia-logos"
        aria-label="Hyundai Kia"
      >
        <img
          src="/assets/figma/logo-hyundai-kia-bottom.png"
          alt="Hyundai Kia"
          className="h-[16px] w-auto"
          draggable={false}
        />
      </div>
    </section>
  );
}
