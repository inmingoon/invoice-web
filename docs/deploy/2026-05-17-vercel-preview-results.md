# Vercel Preview 회귀 결과 — 2026-05-17

> 기준 spec: [`../superpowers/specs/2026-05-17-vercel-deploy-design.md`](../superpowers/specs/2026-05-17-vercel-deploy-design.md)
> 체크리스트: [`./checklist.md`](./checklist.md)

## 환경

- Preview URL: `<채울 것>`
- Production URL (after promote): `<채울 것>`
- Vercel Plan: Hobby
- Functions Region: 자동 (Vercel 기본)
- Node version: `<vercel.json/package.json 기준>`

## 회귀 스크립트 출력

```
<scripts/regression-v1-v7.mjs 실행 결과 stdout 통째로 붙여넣기>
```

## 측정값

| 항목    | 측정값     | 임계  | 마진     |
| ------- | ---------- | ----- | -------- |
| V4-cold | \_\_\_\_ms | 10000 | \_\_\_\_ |
| V4-warm | \_\_\_\_ms | 3000  | \_\_\_\_ |

## 수동 검증

- V5 Notion 수정 반영: PASS / FAIL — 메모: \_\_\_\_
- V7 다크/모바일: PASS / FAIL — 스크린샷: \_\_\_\_

## Production smoke test

- 정상 토큰 1회 다운로드: PASS / FAIL — 파일명: \_\_\_\_
- 헤더 3종: PASS / FAIL — curl -I 출력 캡처: \_\_\_\_
- Vercel Logs 토큰 미등장: PASS / FAIL — 검색어: \_\_\_\_

## 결론

- 전체 게이트: PASS / FAIL
- 후속 액션: \_\_\_\_
