import React from "react";
import { Loading, Screen } from "../src/ui";
import { t } from "../src/i18n/index.ts";

// The root layout redirects as soon as the session is known.
export default function Index() {
  return <Screen scroll={false}><Loading label={t("app.starting")} /></Screen>;
}
