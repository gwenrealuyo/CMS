"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Table from "@/src/components/ui/Table";
import Button from "@/src/components/ui/Button";
import ProspectPipelineChips from "@/src/components/evangelism/ProspectPipelineChips";
import { Prospect } from "@/src/types/evangelism";
import { formatPersonName } from "@/src/lib/name";
import {
  prospectClusterLabel,
  prospectDisplayName,
  prospectSources,
} from "@/src/lib/prospectDisplay";

function SourceBadges({ prospect }: { prospect: Prospect }) {
  const sources = prospectSources(prospect);
  if (sources.length === 0) {
    return <span className="text-xs text-gray-400">Unassigned</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {sources.includes("cluster") && (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
          Cluster
        </span>
      )}
      {sources.includes("evangelism") && (
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
          Evangelism
        </span>
      )}
    </div>
  );
}

interface ProspectsTableProps {
  prospects: Prospect[];
  highlightId?: string | null;
  compact?: boolean;
  /** When true, mobile uses stacked cards; when false, the table scrolls horizontally. */
  mobileCardView?: boolean;
  onUpdateProgress?: (prospect: Prospect) => void;
  onViewPerson?: (prospect: Prospect) => void;
}

export default function ProspectsTable({
  prospects,
  highlightId,
  compact = false,
  mobileCardView = true,
  onUpdateProgress,
  onViewPerson,
}: ProspectsTableProps) {
  const [nameSort, setNameSort] = useState<"asc" | "desc" | null>(null);

  const sortedProspects = useMemo(() => {
    if (!nameSort) return prospects;
    const copy = [...prospects];
    copy.sort((a, b) => {
      const left = prospectDisplayName(a).toLocaleLowerCase();
      const right = prospectDisplayName(b).toLocaleLowerCase();
      const cmp = left.localeCompare(right, undefined, { sensitivity: "base" });
      return nameSort === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [prospects, nameSort]);

  const toggleNameSort = () => {
    setNameSort((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <Table
      columns={[
        {
          header: "Name",
          desktopHeader: (
            <div className="flex items-center gap-1">
              <span>Name</span>
              {nameSort === "desc" ? (
                <span aria-hidden>↓</span>
              ) : nameSort === "asc" ? (
                <span aria-hidden>↑</span>
              ) : (
                <span className="text-gray-300" aria-hidden>
                  ↕
                </span>
              )}
            </div>
          ),
          onHeaderClick: toggleNameSort,
          accessor: "id" as keyof Prospect,
          render: (_value, row) => {
            const highlighted = highlightId && String(row.id) === String(highlightId);
            return (
              <div
                id={`prospect-${row.id}`}
                className={highlighted ? "rounded-md ring-2 ring-primary ring-offset-2" : undefined}
              >
                <p className="text-sm font-medium text-gray-900">
                  {prospectDisplayName(row)}
                </p>
                {row.person?.id != null && (
                  onViewPerson ? (
                    <button
                      type="button"
                      onClick={() => onViewPerson(row)}
                      className="mt-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      View profile
                    </button>
                  ) : (
                    <Link
                      href={`/people?open=${row.person.id}`}
                      className="mt-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      View profile
                    </Link>
                  )
                )}
              </div>
            );
          },
        },
        {
          header: "Source",
          accessor: "evangelism_group" as keyof Prospect,
          render: (_value, row) => <SourceBadges prospect={row} />,
        },
        ...(!compact
          ? [
              {
                header: "Cluster",
                accessor: "inviter_cluster" as keyof Prospect,
                render: (_value: unknown, row: Prospect) => (
                  <span className="text-sm text-gray-700">
                    {prospectClusterLabel(row)}
                  </span>
                ),
              },
              {
                header: "Group",
                accessor: "notes" as keyof Prospect,
                render: (_value: unknown, row: Prospect) => (
                  <span className="text-sm text-gray-700">
                    {row.evangelism_group?.name || "—"}
                  </span>
                ),
              },
            ]
          : [
              {
                header: "Group",
                accessor: "notes" as keyof Prospect,
                render: (_value: unknown, row: Prospect) => (
                  <span className="text-sm text-gray-700">
                    {row.evangelism_group?.name || "—"}
                  </span>
                ),
              },
            ]),
        {
          header: "Invited by",
          accessor: "invited_by" as keyof Prospect,
          render: (_value, row) => (
            <span className="text-sm text-gray-700">
              {formatPersonName(row.invited_by)}
            </span>
          ),
        },
        {
          header: "Pipeline",
          accessor: "pipeline_stage" as keyof Prospect,
          render: (_value, row) => <ProspectPipelineChips prospect={row} />,
        },
        ...(onUpdateProgress
          ? [
              {
                header: "Actions",
                desktopHeader: "",
                accessor: "updated_at" as keyof Prospect,
                render: (_value: unknown, row: Prospect) => (
                  <Button
                    variant="primary"
                    className="min-h-[40px] px-3 text-xs"
                    onClick={() => onUpdateProgress(row)}
                  >
                    Update
                  </Button>
                ),
              },
            ]
          : []),
      ]}
      data={sortedProspects}
      mobileCardView={mobileCardView}
    />
  );
}
