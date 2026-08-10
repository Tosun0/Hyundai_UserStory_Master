const GUI_REFERENCE_WIDTH = 3840;
const GUI_REFERENCE_HEIGHT = 2160;
const GUI_FHD_SCALE = 0.64;
const GUI_MIN_SCALE = 0.56;
const GUI_MAX_SCALE = 1;
const GUI_FHD_REFERENCE_RATIO = 0.5;
const GUI_MOBILE_BREAKPOINT = 900;
const GUI_SCALE_MULTIPLIER = 1.25;

function applyGuiScaleMultiplier(scale: number) {
  return scale * GUI_SCALE_MULTIPLIER;
}

export function getGuiScaleForViewport(width: number, height: number) {
  if (width <= GUI_MOBILE_BREAKPOINT) {
    return applyGuiScaleMultiplier(1);
  }

  const referenceRatio = Math.min(
    width / GUI_REFERENCE_WIDTH,
    height / GUI_REFERENCE_HEIGHT,
  );
  const normalizedRatio =
    (referenceRatio - GUI_FHD_REFERENCE_RATIO) /
    (1 - GUI_FHD_REFERENCE_RATIO);
  const scale =
    GUI_FHD_SCALE + normalizedRatio * (GUI_MAX_SCALE - GUI_FHD_SCALE);

  return applyGuiScaleMultiplier(
    Math.max(GUI_MIN_SCALE, Math.min(GUI_MAX_SCALE, scale)),
  );
}

export function getCurrentGuiScale() {
  if (typeof window === "undefined") {
    return applyGuiScaleMultiplier(GUI_FHD_SCALE);
  }

  return getGuiScaleForViewport(window.innerWidth, window.innerHeight);
}
