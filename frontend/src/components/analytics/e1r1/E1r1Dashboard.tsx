"use client";

import { useMemo, useState } from "react";
import PeopleTallyReport from "@/src/components/evangelism/PeopleTallyReport";
import type { ReportsScopeMeta } from "@/src/types/reports";
import type { Branch } from "@/src/types/branch";

interface E1r1DashboardProps {
  selectedBranchId: string;
  meta: ReportsScopeMeta | null;
}

export default function E1r1Dashboard({
  selectedBranchId,
  meta,
}: E1r1DashboardProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [tallyScope, setTallyScope] = useState("");

  const branch = useMemo(
    (): number | "" => (selectedBranchId ? Number(selectedBranchId) : ""),
    [selectedBranchId],
  );

  const branches = useMemo((): Branch[] => {
    return (meta?.branches ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      is_headquarters: false,
      is_active: true,
    }));
  }, [meta?.branches]);

  return (
    <PeopleTallyReport
      year={year}
      onYearChange={setYear}
      branch={branch}
      branches={branches}
      tallyScope={tallyScope}
      onTallyScopeChange={setTallyScope}
      branchSelectionLocked={meta?.branch_locked ?? false}
      defaultLockedBranch={meta?.effective_branch_id ?? ""}
      hideBranchFilter
    />
  );
}
