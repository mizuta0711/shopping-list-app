import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { ApiError } from "@/types/sync";

export type RequireSessionResult =
  | { error: NextResponse<ApiError>; userId?: undefined }
  | { error?: undefined; userId: string };

export async function requireSession(): Promise<RequireSessionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json<ApiError>(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "ログインが必要です" },
        },
        { status: 401 },
      ),
    };
  }
  return { userId: session.user.id };
}

export function badRequest(
  message: string,
  fields?: Record<string, string>,
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    {
      success: false,
      error: { code: "INVALID_INPUT", message, fields },
    },
    { status: 400 },
  );
}

export function internalError(): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "サーバーエラー" },
    },
    { status: 500 },
  );
}
