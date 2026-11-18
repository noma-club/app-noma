import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const response = NextResponse.redirect(`${origin}/login`, 303);
  response.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
