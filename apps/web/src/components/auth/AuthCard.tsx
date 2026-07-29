"use client";

import { useRouter } from "next/navigation";
import SigninForm from "./SigninForm";
import SignupForm from "./SignupForm";

type AuthMode = "signin" | "signup";

interface AuthCardProps {
  mode: AuthMode;
}

export default function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-md px-4">
      {/* App branding */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">JobSync</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI 驱动的求职追踪助手
        </p>
      </div>

      {/* Tab toggle */}
      <div className="mb-6 flex rounded-xl border bg-muted p-1">
        <button
          onClick={() => router.push("/signin")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
            mode === "signin"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          登录
        </button>
        <button
          onClick={() => router.push("/signup")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
            mode === "signup"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          注册
        </button>
      </div>

      {/* Form card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {mode === "signin" ? (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-semibold">欢迎回来</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                输入邮箱和密码登录账号
              </p>
            </div>
            <SigninForm />
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-semibold">开始使用</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                创建免费账号,开始追踪你的投递
              </p>
            </div>
            <SignupForm />
          </>
        )}
      </div>
    </div>
  );
}
