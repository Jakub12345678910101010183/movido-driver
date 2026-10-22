import React from "react";
import { Loading, Screen } from "../src/ui";

// The root layout redirects as soon as the session is known.
export default function Index() {
  return <Screen scroll={false}><Loading label="Starting MOViDO Driver…" /></Screen>;
}
