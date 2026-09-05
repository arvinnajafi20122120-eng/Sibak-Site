import { NextResponse } from "next/server";

import {
  createSessionToken,
  getSessionUser,
} from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const token =
    await createSessionToken({
      id: user.id,
      role: user.role,
    });

  return NextResponse.json(
    { token },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}