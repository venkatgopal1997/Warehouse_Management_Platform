import { NextResponse } from "next/server";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("wms_session");
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
}

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete("wms_session");
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
}
