// Unit tests: every language has every text with the same {placeholders},
// language detection, and backend errors in the chosen language.
// Offline, no backend:  npm run test:unit
import assert from "node:assert/strict";
import { describeError } from "../src/core/errors.ts";
import { DICTS, langFromLocale, setLang, t } from "../src/i18n/index.ts";
import { en } from "../src/i18n/en.ts";

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
let n = 0;
for (const [lang, dict] of Object.entries(DICTS)) {
  assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort(), `${lang}: keys differ from English`);
  for (const [k, v] of Object.entries(dict)) {
    assert.ok(v.trim().length > 0, `${lang}.${k} is empty`);
    assert.equal(vars(v), vars(en[k as keyof typeof en]), `${lang}.${k}: placeholders differ`);
  }
  n++;
}

assert.equal(langFromLocale("pl-PL"), "pl");
assert.equal(langFromLocale("ro_RO"), "ro");
assert.equal(langFromLocale("en-GB"), "en");
assert.equal(langFromLocale("de-DE"), "en");
assert.equal(langFromLocale(undefined), "en");

setLang("pl");
assert.equal(t("stop.n", { n: 3 }), "Punkt 3");
assert.equal(describeError({ code: "MV409", message: "ANOTHER_JOB_IN_PROGRESS" }), "Zakończ bieżące zlecenie, zanim zaczniesz kolejne.");
setLang("ro");
assert.equal(t("home.hi", { name: "Ion" }), "Salut, Ion");
setLang("en");
assert.equal(describeError({ code: "MV404", message: "JOB_NOT_FOUND" }), "This job is no longer assigned to you.");

console.log(`i18n: ${n} languages × ${Object.keys(en).length} texts, detection and errors passed`);
