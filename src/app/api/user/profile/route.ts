import { NextRequest, NextResponse } from "next/server";
import { syncUserToDatabase, fetchUserFromDatabase } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// GET: Fetch user profile by id, email, or wallet
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || undefined;
    const email = url.searchParams.get("email") || undefined;
    const wallet = url.searchParams.get("wallet") || undefined;

    if (!id && !email && !wallet) {
      return NextResponse.json({ error: "Missing lookup parameter" }, { status: 400, headers: corsHeaders });
    }

    const user = await fetchUserFromDatabase({ id, email, wallet });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, user }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}

// POST / PUT: Update user profile (name, bio, picture, wallet_address, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, name, picture, bio, wallet_address, steam_id, github_username } = body;

    if (!id || !email) {
      return NextResponse.json(
        { error: "Missing required user identity (id, email)" },
        { status: 400, headers: corsHeaders }
      );
    }

    const updatedUser = await syncUserToDatabase({
      id,
      email,
      name: name || email.split("@")[0],
      picture: picture || null,
      bio: bio || null,
      wallet_address: wallet_address || null,
      steam_id: steam_id || null,
      github_username: github_username || null,
    });

    return NextResponse.json({ success: true, user: updatedUser }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
