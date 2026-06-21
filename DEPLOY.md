# 배포 체크리스트 (Vercel)

정적 SPA(Vite) → Vercel 정적 배포. 서버/환경변수 불필요(BYOK).

## 사전 게이트 (배포 전 반드시 통과)

```bash
npm ci
npm run typecheck   # tsc --noEmit, 0 errors
npm test            # vitest, all green
npm run build       # dist/ 생성 확인
```

세 명령이 모두 통과해야 배포합니다. CI에서도 동일 게이트를 강제하세요(아래 GitHub Actions).

## Vercel 설정

- Framework Preset: **Vite** (자동 감지, `vercel.json`에도 명시)
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`
- Environment Variables: **없음** (키는 런타임 사용자 입력)
- Node 버전: 20+ (`engines` 참고)

### CLI 배포

```bash
npm i -g vercel
vercel            # 프리뷰
vercel --prod     # 프로덕션
```

### GitHub 연동 배포

1. 이 저장소를 Vercel 프로젝트에 연결 (New Project → Import Git Repository).
2. main 브랜치 push 시 자동 프로덕션 배포, PR마다 프리뷰 배포.

## 롤백

- Vercel 대시보드 → Deployments → 이전 배포의 **“Promote to Production”**.
- 또는 `vercel rollback <deployment-url>`.

## 배포 후 검증 (smoke)

- [ ] 라이브 URL 200, 첫 화면 렌더
- [ ] 샘플 프리셋 3종 로드 정상 (삽화 placeholder 표시)
- [ ] BYOK 키 입력 → 한 건 생성 성공 (provider 1종 이상)
- [ ] 인쇄 미리보기(Ctrl+P): 문항이 페이지 경계에서 잘리지 않음, 학습지/답안지 모드별 페이지 수 정상
- [ ] 키가 네트워크 요청에서 헤더로만 전송되는지 확인 (URL query 노출 없음)

## 보안 메모

- 키·입력 콘텐츠는 브라우저→AI 제공자로 직접 전송 (중개 서버 없음). [PRIVACY.md](./PRIVACY.md) 참고.
- 정적 자산만 배포되므로 서버 측 비밀이 존재하지 않습니다.
