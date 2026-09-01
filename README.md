# Cube View 002 전달본

현재 루트 프로젝트의 실행·수정에 필요한 소스와 원본 에셋만 모은 전달본입니다.

## 실행

Node.js 20.19 이상 또는 22.12 이상이 필요합니다.

```bash
npm ci
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

```bash
npm run build
npm run preview
```

## 주요 수정 위치

- `src/App.tsx`: Landing → Search → Detail 화면 흐름과 공통 상태
- `src/components/screens/`: 각 화면 UI와 상호작용
- `src/components/three/`: 큐브 렌더링과 카메라 기반 시차 효과
- `src/data/`: 화면 문구, 에셋 경로, AI 채팅 설정
- `src/config/prototypeParams.ts`: 모션과 Glass UI 파라미터
- `public/assets/`: 영상, 이미지, 모델, 폰트

백엔드·환경변수는 없으며 댓글, 투표, 반응 상태는 브라우저 메모리에서만 동작합니다. 카메라 권한을 거부해도 큐브는 마우스로 조작할 수 있습니다.

## 제외한 항목

`node_modules`, `dist`, 로그, 배포 메타데이터, 레퍼런스 프로젝트, 이전 부분 전달본은 제외했습니다. 의존성과 빌드 결과는 위 명령으로 재생성할 수 있습니다.
