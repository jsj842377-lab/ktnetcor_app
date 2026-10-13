This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 관리자 로그인 설정

관리자 로그인은 서버 환경변수로 인증합니다. 프로젝트 루트의 `.env.local`에 아래 값을 설정하고 개발 서버를 재시작하세요.

```dotenv
ADMIN_NAME=관리자
ADMIN_PASSWORD=원하는_관리자_비밀번호
ADMIN_SESSION_SECRET=16자_이상의_랜덤한_비밀값
```

`ADMIN_NAME`은 생략하면 `관리자`가 사용됩니다. `ADMIN_PASSWORD`는 필수이며, `ADMIN_SESSION_SECRET`은 로그인 세션 서명에 필요합니다. 배포 환경에서는 같은 변수를 호스팅 서비스의 서버 환경변수로 설정하고 재배포하세요. 비밀번호와 세션 비밀값을 클라이언트 코드나 저장소에 커밋하지 마세요.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
