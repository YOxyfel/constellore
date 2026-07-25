import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePublicFeedbackApiUrl } from "../scripts/public-feedback-config.mjs";

test("public feedback release configuration accepts blank offline builds and one exact HTTPS endpoint", () => {
  assert.equal(validatePublicFeedbackApiUrl(undefined), "");
  assert.equal(validatePublicFeedbackApiUrl("   "), "");
  assert.equal(
    validatePublicFeedbackApiUrl("  https://Feedback.Example:443/api/combination-reports  "),
    "https://feedback.example/api/combination-reports"
  );
});

test("public feedback release configuration rejects unsafe or inexact endpoints", () => {
  for (const value of [
    "not-a-url",
    "http://feedback.example/api/combination-reports",
    "https://user:password@feedback.example/api/combination-reports",
    "https://feedback.example/api/combination-reports/",
    "https://feedback.example/api/combination-reports?source=release",
    "https://feedback.example/api/combination-reports?",
    "https://feedback.example/api/combination-reports#status",
    "https://feedback.example/api/combination-reports#",
    "https://feedback.example/api/reports"
  ]) {
    assert.throws(
      () => validatePublicFeedbackApiUrl(value),
      /PUBLIC_FEEDBACK_API_URL/,
      `${value} should not be accepted as a release endpoint.`
    );
  }
});

test("every static release workflow passes the same feedback endpoint to build and verification", async () => {
  const [ci, pages, release] = await Promise.all([
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")
  ]);
  const variableLine = /PUBLIC_FEEDBACK_API_URL:\s*\$\{\{\s*vars[.]PUBLIC_FEEDBACK_API_URL\s*\}\}/;
  const commandReceivesVariable = (source, command) => {
    const commandIndex = source.indexOf(`run: ${command}`);
    if (commandIndex < 0) return false;
    const followingSteps = source.slice(commandIndex);
    const nextStepIndex = followingSteps.indexOf("\n      - ", 1);
    const step = nextStepIndex < 0 ? followingSteps : followingSteps.slice(0, nextStepIndex);
    return /\benv:\s*\r?\n/.test(step) && variableLine.test(step);
  };

  for (const command of ["npm run build:pages", "npm run check:pages", "npm run build:itch", "npm run check:itch"]) {
    assert.equal(commandReceivesVariable(ci, command), true, `CI does not pass the feedback endpoint to ${command}.`);
  }
  for (const command of ["npm run build:pages", "npm run check:pages"]) {
    assert.equal(commandReceivesVariable(pages, command), true, `Pages does not pass the feedback endpoint to ${command}.`);
  }
  assert.equal(
    commandReceivesVariable(release, "npm run build:release"),
    true,
    "The tagged release build does not receive the feedback endpoint."
  );
});

test("artifact verifiers require the exact configured endpoint and release docs explain the offline exception", async () => {
  const [pagesVerifier, itchVerifier, releaseDocs] = await Promise.all([
    readFile(new URL("../scripts/verify-pages-build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/verify-itch-build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../RELEASE.md", import.meta.url), "utf8")
  ]);

  for (const verifier of [pagesVerifier, itchVerifier]) {
    assert.match(verifier, /validatePublicFeedbackApiUrl\(process[.]env[.]PUBLIC_FEEDBACK_API_URL\)/);
    assert.match(verifier, /assert[.]equal\([\s\S]{0,180}?expectedFeedbackApiUrl/);
  }
  assert.match(releaseDocs, /PUBLIC_FEEDBACK_API_URL[\s\S]*exact HTTPS URL ending in `?\/api\/combination-reports`?/i);
  assert.match(releaseDocs, /Deliberate local or offline builds may leave the variable empty/i);
});
