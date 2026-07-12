import { WorkOS } from "@workos-inc/node";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);
const clientId = process.env.WORKOS_CLIENT_ID!;

export function getWorkOS() {
  return workos;
}

export function getClientId() {
  return clientId;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("wms_session")?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    // In production, verify the JWT token with WorkOS
    // For now, we decode the session cookie which contains user info
    const session = JSON.parse(
      Buffer.from(sessionToken, "base64").toString("utf-8")
    );
    return session as {
      userId: string;
      email: string;
      name: string;
      organisationId: string;
      organisationName: string;
      role: string;
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login");
  }
  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireSession();
  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard?error=unauthorized");
  }
  return session;
}

// Middleware helper: get the user's org filter for data isolation
export function orgFilter(organisationId: string) {
  return { organisationId };
}
