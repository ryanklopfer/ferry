import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  passkey: vi.fn(async () => ({ data: {}, error: null })),
  magicLink: vi.fn<(opts: { callbackURL: string }) => Promise<{ data: object; error: null }>>(async () => ({ data: {}, error: null })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/app/auth-client", () => ({ authClient: { signIn: { passkey: mocks.passkey, magicLink: mocks.magicLink } } }));

// "/" is the public landing page; every sign-in goes through /home, which sends each role to its own area.
describe("SignInForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("sends a passkey sign-in to /home", async () => {
    render(<SignInForm linkProblem={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Use a passkey instead" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/home"));
    expect(mocks.push).not.toHaveBeenCalledWith("/");
  });

  it("points the magic link at /home", async () => {
    render(<SignInForm linkProblem={false} />);
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "someone@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    await waitFor(() => expect(mocks.magicLink).toHaveBeenCalled());
    expect(mocks.magicLink.mock.calls[0][0].callbackURL).toBe("/home");
  });
});
