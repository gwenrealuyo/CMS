"use client";

import { useMemo } from "react";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import {
  REPORTS_ALL_BRANCHES_VALUE,
  REPORTS_BRANCH_LOCKED_HINT,
} from "@/src/lib/reportsBranchFilter";
import type { ReportsScopeMeta } from "@/src/types/reports";

interface AnalyticsBranchSelectorProps {
  meta: ReportsScopeMeta | null;
  /** Selected branch id as a string; "" means all branches. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Branch picker for the analytics hub.
 *
 * - ADMIN / HQ pastor: editable select with an "All branches" option.
 * - Branch pastor: a locked (disabled) select showing their branch name,
 *   with a tooltip explaining why it cannot be changed.
 */
export default function AnalyticsBranchSelector({
  meta,
  value,
  onChange,
  className = "",
}: AnalyticsBranchSelectorProps) {
  const branchOptions = useMemo(
    () =>
      (meta?.branches ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [meta?.branches],
  );

  if (!meta) {
    return (
      <div className={`w-52 ${className}`.trim()}>
        <ScalableSelect
          options={[]}
          value=""
          onChange={() => {}}
          placeholder="Loading branches..."
          disabled
          showSearch={false}
        />
      </div>
    );
  }

  if (!meta.can_pick_branch) {
    const lockedLabel =
      branchOptions[0]?.label ?? "No branch assigned";
    return (
      <LockedControlTooltip
        label={REPORTS_BRANCH_LOCKED_HINT}
        wrapperClassName={`inline-block w-52 shrink-0 align-middle cursor-default ${className}`.trim()}
      >
        <ScalableSelect
          options={branchOptions}
          value={branchOptions[0]?.value ?? ""}
          onChange={() => {}}
          placeholder={lockedLabel}
          interactionBlocked
          showSearch={false}
        />
      </LockedControlTooltip>
    );
  }

  const editableOptions = [
    { value: REPORTS_ALL_BRANCHES_VALUE, label: "All branches" },
    ...branchOptions,
  ];

  return (
    <div className={`w-52 ${className}`.trim()}>
      <ScalableSelect
        options={editableOptions}
        value={value}
        onChange={onChange}
        placeholder="All branches"
        searchPlaceholder="Search branches..."
        showSearch={branchOptions.length > 8}
      />
    </div>
  );
}
