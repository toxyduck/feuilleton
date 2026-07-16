export type ExpectedUse = "required" | "optional" | "forbidden";

export function widgetMatches(
  expected: string | string[] | undefined,
  observed: string | undefined,
): boolean {
  if (!expected) return true;
  return (Array.isArray(expected) ? expected : [expected]).includes(
    observed ?? "",
  );
}

interface SelectionStatusInput {
  mode: "with-ftn" | "without-ftn";
  expectedUse: ExpectedUse;
  ftnCalls: number;
  artifactIds: number;
  failedFtnCall: boolean;
  artifactMissing: boolean;
  widgetPass: boolean;
  functionalPass: boolean;
}

export function classifySelectionStatus(input: SelectionStatusInput): string {
  const used = input.ftnCalls > 0 || input.artifactIds > 0;
  if (input.mode === "without-ftn")
    return used ? "baseline_contaminated" : "baseline_clean";
  if (input.expectedUse === "forbidden")
    return used
      ? "unnecessary_use"
      : input.functionalPass
        ? "correctly_skipped"
        : "oracle_failed";
  if (input.expectedUse === "optional" && !used)
    return input.functionalPass ? "correctly_skipped" : "oracle_failed";
  if (!used) return "not_attempted";
  if (input.failedFtnCall && !input.artifactIds) return "command_failed";
  if (!input.artifactIds) return "tag_missing";
  if (input.artifactMissing) return "artifact_missing";
  if (!input.widgetPass) return "widget_mismatch";
  if (!input.functionalPass) return "oracle_failed";
  return "applied_correctly";
}
