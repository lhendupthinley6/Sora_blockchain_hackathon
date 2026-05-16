import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the new landing page shell", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          credentialData: {
            "Issuer Name": "RUB Registrar",
            "Student ID": 20240001,
          },
        }),
      })),
    );

    render(<App />);

    expect(await screen.findByText("Sora")).toBeInTheDocument();
    expect(
      screen.getByText("Sora connects students, issuers, and opportunity providers."),
    ).toBeInTheDocument();
  });
});
