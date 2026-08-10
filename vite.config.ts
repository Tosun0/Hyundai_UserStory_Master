import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite는 개발 서버와 번들 빌드를 담당합니다.
// Tailwind v4는 별도 tailwind.config 없이 Vite 플러그인으로 연결합니다.
export default defineConfig(({ mode }) => ({
  plugins: [
    mode === "lan"
      ? basicSsl({
          name: "cube-view-lan",
          domains: ["localhost", "127.0.0.1", "192.168.1.4"],
        })
      : null,
    react(),
    tailwindcss(),
  ].filter(Boolean),
  build: {
    // R3F/three는 추후 3D 콘텐츠용 lazy chunk로 분리됩니다.
    // 의도된 별도 청크라서 Vite의 기본 500kB 경고 기준만 여유 있게 둡니다.
    chunkSizeWarningLimit: 1200,
  },
}));
