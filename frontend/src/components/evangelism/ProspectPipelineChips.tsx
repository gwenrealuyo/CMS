"use client";

import { Prospect } from "@/src/types/evangelism";
import { formatLocaleDate } from "@/src/lib/date";
import { formatPipelineStageLabel } from "@/src/lib/prospectDisplay";

function chip(className: string, label: string) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export default function ProspectPipelineChips({
  prospect,
}: {
  prospect: Prospect;
}) {
  const invited = formatLocaleDate(prospect.date_first_invited);
  const attended = formatLocaleDate(prospect.date_first_attended);
  const lessons = formatLocaleDate(prospect.lessons_finished_at);
  const baptism = formatLocaleDate(prospect.water_baptism_date);
  const receivedHg = formatLocaleDate(prospect.spirit_baptism_date);
  const reached = formatLocaleDate(prospect.reached_date);

  return (
    <div className="flex flex-wrap gap-1.5">
      {chip(
        "bg-purple-50 text-purple-700",
        formatPipelineStageLabel(prospect.pipeline_stage),
      )}
      {invited && chip("bg-slate-50 text-slate-700", `Invited ${invited}`)}
      {attended && chip("bg-cyan-50 text-cyan-700", `Attended ${attended}`)}
      {lessons &&
        chip("bg-indigo-50 text-indigo-700", `Lessons Finished ${lessons}`)}
      {baptism && chip("bg-amber-50 text-amber-700", `Baptism ${baptism}`)}
      {receivedHg &&
        chip("bg-emerald-50 text-emerald-700", `Received HG ${receivedHg}`)}
      {reached && chip("bg-green-50 text-green-700", `Reached ${reached}`)}
    </div>
  );
}
