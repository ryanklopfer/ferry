import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import ClinicianHome from "@/app/app/page";
import HomePage from "@/app/home/page";
import { proxy } from "@/proxy";
import { pool } from "@/server/db";
import { createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
import ForClientsPage from "../for-clients/page";
import StartPage from "./page";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const decode = (s: string) => s.replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();
const links = (element: ReactElement) =>
  [...renderToStaticMarkup(element).matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: decode(m[1]), text: decode(m[2]) }));
const start = (query: Record<string, string> = {}) => StartPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) });
const roleOf = async (userId: string) => (await pool.query<{ role: string }>("select role from users where id = $1", [userId])).rows[0].role;

describe("/start fork", () => {
  let pending: { userId: string };

  beforeEach(async () => {
    await resetDb();
    pending = await createTestUser("pending", "maybe@example.test");
    request.headers = await signedInHeaders("maybe@example.test");
  });
  afterAll(() => pool.end());

  it("offers exactly the two doors", async () => {
    expect(links(await start()).map((l) => l.text)).toEqual(["I'm a clinician", "I'm a client"]);
  });

  it("until N5, the clinician door stays on /start and says sign-up opens soon instead of looping through /sign-in", async () => {
    const door = links(await start()).find((l) => l.text === "I'm a clinician")!.href;
    const url = new URL(door, "http://localhost:3000");
    expect(url.pathname).toBe("/start");
    expect(proxy(new NextRequest(url)).headers.get("x-middleware-next")).toBe("1");

    expect(renderToStaticMarkup(await start()).toLowerCase()).not.toContain("opens soon");
    const after = renderToStaticMarkup(await start(Object.fromEntries(url.searchParams)));
    expect(decode(after)).toContain("Clinician sign-up opens soon.");
    expect(await roleOf(pending.userId)).toBe("pending");
  });

  it("a pending user choosing 'I'm a client' lands on /for-clients with the role still pending", async () => {
    const choice = links(await start()).find((l) => l.text === "I'm a client");
    expect(choice?.href).toBe("/for-clients");

    const cookie = request.headers.get("cookie") ?? "";
    for (const headers of [{ cookie }, undefined]) {
      const response = proxy(new NextRequest(`http://localhost:3000${choice!.href}`, headers ? { headers } : undefined));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
    expect(renderToStaticMarkup(createElement(ForClientsPage))).toContain("<h1");
    expect(await roleOf(pending.userId)).toBe("pending");
  });

  it("never reaches clinician onboarding from there", async () => {
    const clinicianDoor = links(await start()).find((l) => l.text === "I'm a clinician")!.href;
    const onward = links(createElement(ForClientsPage)).map((l) => l.href);
    expect(onward).not.toContain(clinicianDoor);
    expect(onward.filter((h) => /^\/(app|sign-in)(\/|\?|$)/.test(h))).toEqual([]);

    await expect(ClinicianHome()).rejects.toThrow("notFound");
    await expect(HomePage()).rejects.toThrow("redirect:/start");
    expect(await roleOf(pending.userId)).toBe("pending");
  });
});
