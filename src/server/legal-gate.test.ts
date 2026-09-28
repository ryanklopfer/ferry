import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tempLegalDir } from "@/test-support/legal-dir";
import { assertLiveLegal, LegalPlaceholder, legalDir } from "./legal";

describe("assertLiveLegal", () => {
  let legal: ReturnType<typeof tempLegalDir> | undefined;
  afterEach(() => legal?.restore());

  it("refuses the repo's texts today: every one is still a placeholder", async () => {
    await expect(assertLiveLegal(["npi_filing_authorization"])).rejects.toBeInstanceOf(LegalPlaceholder);
    await expect(assertLiveLegal(["terms", "baa", "privacy", "client_filing", "client_recording"])).rejects.toBeInstanceOf(LegalPlaceholder);
  });

  it("throws for npi_filing_authorization while placeholder is true and passes once it is false", async () => {
    legal = tempLegalDir();
    await expect(assertLiveLegal(["npi_filing_authorization"])).rejects.toMatchObject({ name: "LegalPlaceholder", docTypes: ["npi_filing_authorization"] });
    legal.setPlaceholder("npi_filing_authorization", false);
    await expect(assertLiveLegal(["npi_filing_authorization"])).resolves.toBeUndefined();
    await expect(assertLiveLegal(["npi_filing_authorization", "terms"])).rejects.toMatchObject({ docTypes: ["terms"] });
  });

  it("reads FERRY_LEGAL_DIR only in the dev tier, so no deployment can point it at other texts", () => {
    const repo = path.join(process.cwd(), "content", "legal");
    expect(legalDir({ FERRY_LEGAL_DIR: "/tmp/elsewhere" })).toBe("/tmp/elsewhere");
    for (const tier of ["prelaunch", "staging", "prod"]) expect(legalDir({ FERRY_DEPLOY_TIER: tier, FERRY_LEGAL_DIR: "/tmp/elsewhere" }), tier).toBe(repo);
    expect(legalDir({ NODE_ENV: "production", FERRY_LEGAL_DIR: "/tmp/elsewhere" })).toBe(repo);
    expect(legalDir({})).toBe(repo);
  });
});
