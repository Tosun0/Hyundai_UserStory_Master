export type ScreenId = "landing" | "search";

export const prototypeAssets = {
  landingBg: "/assets/figma/landing-bg.png",
} as const;

export const prototypeText = {
  landingButton: "GO",
  orbitTitle: "워킹맘",
  orbitStats: [
    { id: "views", icon: "visibility", label: "2.4천회" },
    { id: "comments", icon: "comment", label: "36개" },
    { id: "reactions", icon: "share_windows", label: "800회" },
  ],
} as const;
