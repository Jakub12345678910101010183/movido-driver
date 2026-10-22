// Unit tests: backend error → driver message (one job in progress at a time).
// Offline, no backend:  npm run test:unit
import assert from "node:assert/strict";
import { describeError, isRetryable } from "../src/core/errors.ts";

const another = { code: "MV409", message: "ANOTHER_JOB_IN_PROGRESS" };
assert.equal(describeError(another), "Finish your current job before starting another.");
assert.equal(isRetryable(another), false);
assert.equal(describeError({ code: "MV404", message: "JOB_NOT_FOUND" }), "This job is no longer assigned to you.");
console.log("errors: 3 passed");
