# Next.js에 Clerk 연동하기

이 문서는 Next.js 애플리케이션에 Clerk 인증 시스템을 연동하는 과정을 단계별로 설명합니다.

## 목차
1. [Clerk 패키지 설치](#1-clerk-패키지-설치)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [ClerkProvider 설정](#3-clerkprovider-설정)
4. [Middleware 설정](#4-middleware-설정)
5. [페이지에서 Clerk 사용하기](#5-페이지에서-clerk-사용하기)
6. [주요 컴포넌트 및 훅](#6-주요-컴포넌트-및-훅)

---

## 1. Clerk 패키지 설치

먼저 Clerk의 Next.js 패키지를 설치합니다.

```bash
npm install @clerk/nextjs
```

**package.json**에서 확인할 수 있는 설치된 패키지:

```json
  {
    "dependencies": {
      "@clerk/nextjs": "^6.25.4",
      "next": "15.4.2",
      "react": "19.1.0",
      "react-dom": "19.1.0"
    }
  }
```

---

## 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 Clerk Dashboard에서 얻은 키들을 설정합니다:

```env
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  
  # 선택사항: 로그인/회원가입 후 리다이렉트 URL
  NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
  NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

---

## 3. ClerkProvider 설정

**app/layout.tsx**에서 `ClerkProvider`로 애플리케이션을 감쌉니다:

```tsx
  import { type Metadata } from 'next'
  import {
    ClerkProvider,
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
  } from '@clerk/nextjs'
  import { Geist, Geist_Mono } from 'next/font/google'
  import './globals.css'

  const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
  })

  const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
  })

  export const metadata: Metadata = {
    title: 'Clerk Next.js Quickstart',
    description: 'Generated by create next app',
  }

  export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode
  }>) {
    return (
      <ClerkProvider>
        <html lang="en">
          <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
            <header className="flex justify-end items-center p-4 gap-4 h-16">
              <SignedOut>
                <SignInButton />
                <SignUpButton>
                  <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </header>
            {children}
          </body>
        </html>
      </ClerkProvider>
    )
  }
```

### 주요 구성 요소:
- **ClerkProvider**: 전체 애플리케이션을 감싸는 컨텍스트 제공자
- **SignedIn/SignedOut**: 로그인 상태에 따른 조건부 렌더링
- **SignInButton/SignUpButton**: 로그인/회원가입 버튼
- **UserButton**: 로그인된 사용자의 프로필 버튼

---

## 4. Middleware 설정

**middleware.ts** 파일을 프로젝트 루트에 생성합니다:

```typescript
  import { clerkMiddleware } from '@clerk/nextjs/server';

  export default clerkMiddleware();

  export const config = {
    matcher: [
      // Skip Next.js internals and all static files, unless found in search params
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      // Always run for API routes
      '/(api|trpc)(.*)',
    ],
  };
```

### Middleware의 역할:
- 모든 요청에서 인증 상태를 확인
- 보호된 라우트에 대한 접근 제어
- 자동으로 인증 토큰 관리

---

## 5. 페이지에서 Clerk 사용하기

**app/page.tsx**에서 Clerk 컴포넌트와 훅을 사용한 예시:

```tsx
  "use client";

  import { SignedIn, SignedOut, useUser, SignInButton } from "@clerk/nextjs";

  export default function Home() {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full mx-auto p-8 bg-white rounded-lg shadow-md text-center">
          {/* 로그인된 사용자에게 표시할 내용 */}
          <SignedIn>
            <WelcomeMessage />
          </SignedIn>

          {/* 로그인되지 않은 사용자에게 표시할 내용 */}
          <SignedOut>
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900">
                로그인을 진행해주세요
              </h1>
              <p className="text-gray-600">
                서비스를 이용하기 위해 로그인이 필요합니다.
              </p>
              <div className="pt-4">
                <SignInButton mode="modal">
                  <button className="w-full bg-[#6c47ff] hover:bg-[#5639d9] text-white font-medium py-3 px-6 rounded-lg transition-colors">
                    로그인하기
                  </button>
                </SignInButton>
              </div>
            </div>
          </SignedOut>
        </div>
      </div>
    );
  }

  function WelcomeMessage() {
    const { user } = useUser();
    
    return (
      <div className="space-y-6">
        <div className="text-6xl">👋</div>
        <h1 className="text-2xl font-bold text-gray-900">
          환영합니다, {user?.firstName || user?.username || "사용자"}님!
        </h1>
        <p className="text-gray-600">
          성공적으로 로그인되었습니다.
        </p>
        <div className="pt-4 text-sm text-gray-500">
          <p>이메일: {user?.emailAddresses[0]?.emailAddress}</p>
        </div>
      </div>
    );
  }
```

### 주요 특징:
- **"use client"**: 클라이언트 사이드 컴포넌트 명시
- **조건부 렌더링**: 로그인 상태에 따른 다른 UI 표시
- **사용자 정보 접근**: `useUser` 훅으로 사용자 데이터 사용

---

## 6. 주요 컴포넌트 및 훅

### 조건부 렌더링 컴포넌트

```tsx
  import { SignedIn, SignedOut } from "@clerk/nextjs";

  // 로그인된 사용자에게만 표시
  <SignedIn>
    <div>로그인된 사용자 전용 콘텐츠</div>
  </SignedIn>

  // 로그인되지 않은 사용자에게만 표시
  <SignedOut>
    <div>비로그인 사용자 전용 콘텐츠</div>
  </SignedOut>
```

### 인증 관련 버튼

```tsx
  import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

  // 로그인 버튼
  <SignInButton mode="modal">
    <button>로그인</button>
  </SignInButton>

  // 회원가입 버튼  
  <SignUpButton mode="modal">
    <button>회원가입</button>
  </SignUpButton>

  // 사용자 프로필 버튼 (로그인된 상태에서만 사용)
  <UserButton />
```

### 사용자 정보 훅

```tsx
  import { useUser, useAuth } from "@clerk/nextjs";

  function UserProfile() {
    const { user, isLoaded } = useUser();
    const { signOut } = useAuth();

    if (!isLoaded) return <div>로딩 중...</div>;

    return (
      <div>
        <p>사용자명: {user?.username}</p>
        <p>이메일: {user?.emailAddresses[0]?.emailAddress}</p>
        <button onClick={() => signOut()}>로그아웃</button>
      </div>
    );
  }
```

### 서버 사이드에서 사용자 정보 접근

```tsx
  import { currentUser } from "@clerk/nextjs/server";

  export default async function ServerPage() {
    const user = await currentUser();

    return (
      <div>
        {user ? (
          <p>환영합니다, {user.firstName}님!</p>
        ) : (
          <p>로그인이 필요합니다.</p>
        )}
      </div>
    );
  }
```

---

## 추가 설정 옵션

### 사용자 정의 페이지 라우트

```typescript
  // middleware.ts에서 보호된 라우트 설정
  import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

  const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/admin(.*)'])

  export default clerkMiddleware((auth, req) => {
    if (isProtectedRoute(req)) auth().protect()
  })
```

### 테마 커스터마이징

```tsx
  // layout.tsx에서 ClerkProvider에 appearance prop 추가
  <ClerkProvider
    appearance={{
      baseTheme: dark, // 또는 neobrutalism
      variables: {
        colorPrimary: "#6c47ff",
        borderRadius: "8px"
      }
    }}
  >
    {/* ... */}
  </ClerkProvider>
```

---

## 결론

이제 Next.js 애플리케이션에 Clerk 인증 시스템이 성공적으로 연동되었습니다. 
주요 기능들:

✅ **완전한 사용자 인증 시스템**  
✅ **소셜 로그인 지원**  
✅ **사용자 프로필 관리**  
✅ **세션 관리**  
✅ **보안 강화된 라우트 보호**  

더 자세한 정보는 [Clerk 공식 문서](https://clerk.com/docs)를 참고하세요. 