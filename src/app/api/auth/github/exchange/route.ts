import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, clientId: clientProvidedId, clientSecret: clientProvidedSecret } = body;

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const clientId =
      process.env.GITHUB_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ||
      clientProvidedId;
    const clientSecret =
      process.env.GITHUB_CLIENT_SECRET ||
      clientProvidedSecret;

    if (!clientId || !clientSecret) {
      // If server does not have client secret configured, return instructions
      return NextResponse.json(
        {
          error: "GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured on server",
          needsConfig: true,
        },
        { status: 400 }
      );
    }

    // 1. Exchange code for access_token with GitHub OAuth
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      return NextResponse.json(
        { error: tokenData.error_description || tokenData.error || "Failed to exchange code" },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch authenticated user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Koliance-AgentCard/1.0",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: "Failed to fetch user profile from GitHub" }, { status: 400 });
    }

    const userData = await userRes.json();

    // 3. Fetch user repositories
    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=12", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Koliance-AgentCard/1.0",
        Accept: "application/vnd.github.v3+json",
      },
    });

    const reposData: any[] = reposRes.ok ? await reposRes.json() : [];

    let totalStars = 0;
    const langSet = new Set<string>();
    const topRepos = [];

    for (const r of reposData) {
      totalStars += r.stargazers_count || 0;
      if (r.language) langSet.add(r.language);
      topRepos.push({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description || "Open source repository",
        language: r.language || "TypeScript",
        stargazers_count: r.stargazers_count || 0,
        forks_count: r.forks_count || 0,
        updated_at: r.updated_at,
      });
    }

    const reposCount = userData.public_repos || topRepos.length;
    let tier = "VERIFIED DEVELOPER";
    let creditUSD = 500;

    if (reposCount >= 10 || totalStars >= 5) {
      tier = "CORE BUIDLER";
      creditUSD = 1000;
    }
    if (reposCount >= 25 || totalStars >= 20) {
      tier = "TITAN ARCHITECT";
      creditUSD = 2500;
    }

    return NextResponse.json({
      success: true,
      stats: {
        username: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
        htmlUrl: userData.html_url,
        bio: userData.bio || "Verified GitHub Developer",
        company: userData.company || "Independent",
        location: userData.location || "Earth",
        publicRepos: reposCount,
        followers: userData.followers || 0,
        totalStars,
        languages: Array.from(langSet),
        topRepos,
        buidlTier: tier,
        creditAllowanceUSD: creditUSD,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
