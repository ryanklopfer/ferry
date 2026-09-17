import { describe, expect, it } from "vitest";
import { ID_PREFIXES, newId } from "./ids";

describe("newId", () => {
  it.each(ID_PREFIXES)("makes %s ids as prefix, underscore, 26 Crockford base32 characters", (prefix) => {
    expect(newId(prefix)).toMatch(new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`));
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId("clm")));
    expect(ids.size).toBe(10_000);
  });

  it("sorts in creation order", async () => {
    const first = newId("clm");
    await new Promise((r) => setTimeout(r, 3));
    const second = newId("clm");
    expect([second, first].sort()).toEqual([first, second]);
  });

  it("refuses a prefix it does not know", () => {
    expect(() => newId("usr" as never)).toThrow();
  });
});
