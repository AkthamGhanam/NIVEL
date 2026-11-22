import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

const { GET } = await import("./route");

describe("GET /api/health", () => {
  it("responde 200 con estado ok y sin datos internos", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
