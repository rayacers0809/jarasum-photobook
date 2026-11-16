# JARASUM — Official Digital Photobook

자라섬 공식 디지털 포토북 · SPECIAL EDITION VOL.01
개인 포토북 9종(루뭉 · 도담히 · 돗챠 · 뚜닝 · 빅윈 · 하밍 · 다래 · 으네 · 시로) + 단체 포토북 1종(ALL TOGETHER).

- 실물 하드커버 책 형태의 컬렉션, 펼쳐서 넘기는 3D 페이지 뷰어 (PC 양면 / 모바일 단면, 스와이프·탭·키보드, 전체 화면, 확대)
- 관리자(`/admin/`)에서 표지·내지 업로드, 순서 변경, 문구 수정, 공개/비공개 — 저장 즉시 사이트 반영

## Stack
Next.js 15 (App Router, static export) · TypeScript · Tailwind CSS v4 · Supabase (DB · Storage · Auth)

## Supabase
webtoon 프로젝트(`nwgxznnfilbsnipwumsu`) 안에 포토북 전용 리소스로 분리되어 있음.

| 리소스 | 내용 |
|---|---|
| `photobook_books` | 포토북 10권 (id, kind, name, en, title, slogan, description, profile, credits, color, is_public, cover_path) |
| `photobook_pages` | 내지 사진 (book_id, position, section, caption, image_path) |
| Storage `photobook` | 공개 버킷, 경로 `{book_id}/{uuid}.jpg` |

RLS: 공개 포토북은 누구나 읽기, 쓰기·업로드는 `public.is_staff()` 관리자만 (웹툰 관리자 계정 공유).

## 배포 (Cloudflare Pages)
GitHub 연동으로 `main`에 push하면 자동 배포.
- Framework preset: Next.js (Static HTML Export)
- Build command: `npm run build`
- Build output directory: `out`
- 환경변수: `NODE_VERSION=22` (`NEXT_PUBLIC_BASE_PATH`는 비워둠)

## 로컬
```bash
npm install
npm run dev
```
