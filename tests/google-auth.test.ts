import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/auth/google/exchange/route";
import { NextRequest } from "next/server";

describe("Google OAuth API Route", () => {
  it("should reject requests without authorization code or id_token", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/google/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Missing authorization code or id_token/);
  });

  it("should reject invalid Google id_token gracefully", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/google/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: "invalid_mock_token_123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
  }, 15000);
});
