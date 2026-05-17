# Vercel 배포 체크리스트 (viewer-only)

> 기준 spec: [`../superpowers/specs/2026-05-17-vercel-deploy-design.md`](../superpowers/specs/2026-05-17-vercel-deploy-design.md)

각 배포마다 본 체크리스트를 복사해 일자별 결과 파일에 첨부한다.

## 사전 조건

- [ ] Vercel 프로젝트 연결 완료 (GitHub Integration, Production Branch = main)
- [ ] Production env 4종 주입 완료
  - [ ] `NOTION_TOKEN`
  - [ ] `NOTION_DATABASE_ID`
  - [ ] `NOTION_DATA_SOURCE_ID` (선택)
  - [ ] `LOG_LEVEL=info`
- [ ] origin/main에 출시 게이트 커밋이 push 됨
- [ ] Preview deployment URL 확보

## Preview 검증

회귀 스크립트 실행:

```bash
BASE_URL=https://invoice-web-git-main-<user>.vercel.app \
ROW_A_ID=<id> ROW_A_TOKEN=<token> \
ROW_B_ID=<id> ROW_B_TOKEN=<token> \
node scripts/regression-v1-v7.mjs
```

- [ ] V1 정상 PASS
- [ ] V2 누락 PASS (404)
- [ ] V3 변조 PASS (404)
- [ ] V4-cold PASS (status 200 + %PDF), 소요 시간 < 10s (마진 ≥ 2s)
- [ ] V4-warm PASS, 소요 시간 < 3s
- [ ] HEADER-1 PASS (invoice 헤더 3종)
- [ ] HEADER-2 PASS (PDF 헤더 3종 + Content-Disposition: attachment)
- [ ] V6 만료 배지 PASS
- [ ] ADMIN-404 /admin PASS (404)
- [ ] ADMIN-404 /admin-login PASS (404)

수동:

- [ ] V5 Notion 수정 반영: row 금액 수정 후 V1 새로고침 → 새 값 가시
- [ ] V7 다크/모바일: Playwright MCP로 360px + dark mode toggle → 가로 스크롤 0, 가독성 유지

## Promote

- [ ] Vercel Dashboard → Deployments → 검증한 Preview build → "Promote to Production"
- [ ] Production URL alias 확인

## Production 수동 검증

- [ ] 정상 토큰으로 PDF 1회 다운로드 성공
- [ ] 응답 헤더 3종 prod에서도 일치 (`curl -I` 또는 DevTools)
- [ ] Vercel Logs에서 토큰 substring 미등장 확인

## 사후

- [ ] `docs/deploy/<YYYY-MM-DD>-vercel-preview-results.md` 측정값 기록
- [ ] `docs/ROADMAP.md` P5-T7 비고 갱신

## 실패 시

- V4-cold ≥ 9s: plan 재검토 — Pro 전환 또는 폰트/페이지 최적화 검토
- ADMIN-404 미응답: middleware matcher/분기 로직 점검, promote 차단
- HEADER 미일치: `vercel.json` headers 패턴 확인, promote 차단
