import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOAuthDomainAllowed, parseOAuthAllowedDomains } from "../src/shared/auth/oauthAccess";

describe("OAuth domain access control", () => {
  it("normalizes comma-separated allowed domains", () => {
    assert.deepEqual(
      parseOAuthAllowedDomains(" punjab.gov.pk, EPA.PUNJAB.GOV.PK ,, "),
      ["punjab.gov.pk", "epa.punjab.gov.pk"]
    );
  });

  it("does not allow public OAuth registration when the allow-list is empty", () => {
    assert.equal(isOAuthDomainAllowed("citizen@gmail.com", ""), false);
  });

  it("allows only explicitly configured domains", () => {
    const allowed = "punjab.gov.pk,epa.punjab.gov.pk";

    assert.equal(isOAuthDomainAllowed("learner@punjab.gov.pk", allowed), true);
    assert.equal(isOAuthDomainAllowed("trainer@epa.punjab.gov.pk", allowed), true);
    assert.equal(isOAuthDomainAllowed("citizen@gmail.com", allowed), false);
  });
});
