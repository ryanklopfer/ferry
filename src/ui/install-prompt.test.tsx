import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt } from "./install-prompt";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

function setDevice(userAgent: string, standalone = false) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: standalone && query === "(display-mode: standalone)", media: query }) as MediaQueryList);
}

function installEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  e.prompt = vi.fn(async () => {});
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

describe("InstallPrompt", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("offers the browser's install prompt on Android and desktop Chrome, and hides once accepted", async () => {
    setDevice(ANDROID);
    render(<InstallPrompt />);
    expect(screen.queryByRole("button", { name: /install/i })).toBeNull();

    const e = installEvent();
    act(() => void window.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(true);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Install Ferry" })));
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("leaves no dead Install button when the browser's dialog is cancelled, and comes back on the next prompt", async () => {
    setDevice(ANDROID);
    render(<InstallPrompt />);
    act(() => void window.dispatchEvent(installEvent("dismissed")));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Install Ferry" })));
    expect(screen.queryByRole("complementary")).toBeNull();

    const again = installEvent();
    act(() => void window.dispatchEvent(again));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Install Ferry" })));
    expect(again.prompt).toHaveBeenCalledOnce();
  });

  it("shows an Add to Home Screen sheet on iOS, which has no install prompt", () => {
    setDevice(IPHONE);
    render(<InstallPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Add to Home Screen" }));
    expect(screen.getByRole("dialog", { name: "Add Ferry to your Home Screen" })).toBeTruthy();
  });

  it("is hidden once installed", () => {
    setDevice(IPHONE, true);
    render(<InstallPrompt />);
    act(() => void window.dispatchEvent(installEvent()));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("hides when the app is installed from the browser menu", () => {
    setDevice(ANDROID);
    render(<InstallPrompt />);
    act(() => void window.dispatchEvent(installEvent()));
    expect(screen.getByRole("complementary")).toBeTruthy();
    act(() => void window.dispatchEvent(new Event("appinstalled")));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("stays away after Not now", () => {
    setDevice(IPHONE);
    const first = render(<InstallPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    first.unmount();
    render(<InstallPrompt />);
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
