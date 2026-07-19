import { NextRequest, NextResponse } from "next/server";

// When APP_PASSWORD is set, every route requires the auth cookie issued by
// /api/login. Without APP_PASSWORD the app is open (fine for localhost).
const PUBLIC = [
  /^\/login$/,
  /^\/api\/login$/,
  /^\/_next\//,
  /^\/manifest\.webmanifest$/,
  /^\/icon-\d+\.png$/,
  /^\/apple-touch-icon\.png$/,
  /^\/favicon\.ico$/,
];

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const cookie = req.cookies.get("jobfind_auth")?.value;
  if (cookie === (await sha256(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

async function sha256(s: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
