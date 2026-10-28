"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { evangelismApi } from "@/src/lib/api";
import {
  SundayBibleStudyReport,
  SundaySessionType,
  sessionTypeLabel,
} from "@/src/types/sundayBibleStudy";
import { mostRecentSunday } from "@/src/components/evangelism/sundayBibleStudyDates";
import SundayBibleStudyReportForm from "@/src/components/evangelism/SundayBibleStudyReportForm";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Modal from "@/src/components/ui/Modal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  getIsoWeekDateRange,
  getIsoWeekParts,
  getIsoWeekPartsFromDateString,
  isoWeeksInYear,
} from "@/src/lib/isoWeek";

const ALL_WEEKS = "all";
const todayIso = getIsoWeekParts(new Date());

function formatWeekDateRange(year: number, weekNumber: number): string {
  const { start, end } = getIsoWeekDateRange(year, weekNumber);
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function initialWeekSelection(): { year: number; weeks: string[] } {
  const parts = getIsoWeekPartsFromDateString(mostRecentSunday()) ?? todayIso;
  return { year: parts.year, weeks: [String(parts.week)] };
}

interface SundayBibleStudyReportsProps {
  facilitators: { id: number; name: string }[];
  canWrite: boolean;
  canDelete: boolean;
  /** True only for a new navbar quick-action request to open a blank report. */
  openFormRequest?: boolean;
  onFormRequestHandled?: () => void;
}

export default function SundayBibleStudyReports({
  facilitators,
  canWrite,
  canDelete,
  openFormRequest = false,
  onFormRequestHandled,
}: SundayBibleStudyReportsProps) {
  const initialWeeks = useMemo(() => initialWeekSelection(), []);
  const [sessionDate, setSessionDate] = useState(mostRecentSunday);
  const [selectedYear, setSelectedYear] = useState(initialWeeks.year);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(initialWeeks.weeks);
  const [sessionType, setSessionType] = useState<"" | SundaySessionType>("");
  const [facilitatorId, setFacilitatorId] = useState("");
  const [cancelled, setCancelled] = useState<"" | "true" | "false">("");
  const [reports, setReports] = useState<SundayBibleStudyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SundayBibleStudyReport | null>(null);
  const [viewing, setViewing] = useState<SundayBibleStudyReport | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const weekOptions = useMemo(
    () =>
      isoWeeksInYear(selectedYear).map((weekNum) => {
        const range = formatWeekDateRange(selectedYear, weekNum);
        const isCurrentWeek =
          selectedYear === todayIso.year && weekNum === todayIso.week;
        return {
          value: String(weekNum),
          label: isCurrentWeek
            ? `W${weekNum} (${range}) · current`
            : `W${weekNum} (${range})`,
        };
      }),
    [selectedYear],
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>([selectedYear]);
    for (let offset = -2; offset <= 1; offset += 1) {
      years.add(todayIso.year + offset);
    }
    return Array.from(years).sort((left, right) => right - left);
  }, [selectedYear]);

  const handleWeeksChange = (values: string[]) => {
    const hadAll = selectedWeeks.includes(ALL_WEEKS);
    const hasAll = values.includes(ALL_WEEKS);
    if (hasAll && !hadAll) {
      setSelectedWeeks([ALL_WEEKS]);
      return;
    }
    if (hadAll && hasAll) {
      setSelectedWeeks(values.filter((value) => value !== ALL_WEEKS));
      return;
    }
    setSelectedWeeks(values.length > 0 ? values : [ALL_WEEKS]);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedWeeks((current) => {
      if (current.includes(ALL_WEEKS)) return [ALL_WEEKS];
      const valid = new Set(isoWeeksInYear(year).map(String));
      const next = current.filter((week) => valid.has(week));
      if (next.length > 0) return next;
      if (year === todayIso.year && valid.has(String(todayIso.week))) {
        return [String(todayIso.week)];
      }
      const weeks = isoWeeksInYear(year);
      return weeks.length > 0 ? [String(weeks[weeks.length - 1])] : [ALL_WEEKS];
    });
  };

  const applySunday = (value: string) => {
    setSessionDate(value);
    const parts = getIsoWeekPartsFromDateString(value);
    if (!parts) return;
    setSelectedYear(parts.year);
    setSelectedWeeks([String(parts.week)]);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const specificWeeks = selectedWeeks
      .filter((week) => week !== ALL_WEEKS)
      .map((week) => Number(week))
      .filter((week) => Number.isInteger(week))
      .sort((left, right) => left - right);
    try {
      const response = await evangelismApi.listSundayBibleStudies({
        year: selectedWeeks.includes(ALL_WEEKS) || specificWeeks.length > 0
          ? selectedYear
          : undefined,
        week_number:
          !selectedWeeks.includes(ALL_WEEKS) && specificWeeks.length > 0
            ? specificWeeks.join(",")
            : undefined,
        session_date:
          !selectedWeeks.includes(ALL_WEEKS) && specificWeeks.length === 0
            ? sessionDate || undefined
            : undefined,
        session_type: sessionType || undefined,
        facilitator: facilitatorId || undefined,
        cancelled: cancelled || undefined,
        page_size: 50,
      });
      const data = response.data;
      setReports(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      console.error(err);
      setError("Could not load Bible study reports.");
    } finally {
      setLoading(false);
    }
  }, [
    sessionDate,
    selectedYear,
    selectedWeeks,
    sessionType,
    facilitatorId,
    cancelled,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openFormRequest) return;
    if (canWrite) {
      setEditing(null);
      setFormOpen(true);
    }
    onFormRequestHandled?.();
  }, [openFormRequest, canWrite, onFormRequestHandled]);

  const exportRows = reports.map((report) => ({
    Branch: report.branch_name,
    Date: report.session_date,
    Week: `${report.year} W${report.week_number}`,
    Session: sessionTypeLabel(report.session_type),
    Format: report.cancelled ? "Cancelled" : report.gathering_type || "",
    Facilitators: report.facilitator_details.map((row) => row.name).join(", "),
    Members: report.member_count,
    "First-time": report.first_time_count,
    Returning: report.returning_count,
    Total: report.total_attendance,
    Topic: report.topic,
  }));

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Bible Study Reports");
    XLSX.writeFile(book, "sunday_bible_study_reports.xlsx");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    autoTable(doc, {
      head: [Object.keys(exportRows[0] ?? { Branch: "" })],
      body: exportRows.map((row) => Object.values(row).map(String)),
    });
    doc.save("sunday_bible_study_reports.pdf");
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Sunday
            <input
              type="date"
              value={sessionDate}
              onChange={(event) => applySunday(event.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Year
            <select
              value={selectedYear}
              onChange={(event) => handleYearChange(Number(event.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm font-medium text-gray-700">
            Weeks
            <div className="mt-1">
              <ScalableSelect
                multiple
                options={weekOptions}
                values={selectedWeeks}
                onValuesChange={handleWeeksChange}
                pinnedOption={{ value: ALL_WEEKS, label: "All Weeks" }}
                scrollToValue={
                  weekOptions.some((option) => option.value === String(todayIso.week))
                    ? String(todayIso.week)
                    : selectedWeeks[selectedWeeks.length - 1]
                }
                placeholder="Select weeks"
                searchPlaceholder="Search weeks..."
                className="w-full"
                showSearch
                maxHeight={280}
                emptyMessage="No weeks found"
              />
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Session
            <select
              value={sessionType}
              onChange={(event) => setSessionType(event.target.value as "" | SundaySessionType)}
              className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
            >
              <option value="">Before and after</option>
              <option value="BEFORE_SERVICE">Before Service</option>
              <option value="AFTER_SERVICE">After Service</option>
            </select>
          </label>
          <div className="block text-sm font-medium text-gray-700">
            Facilitator
            <div className="mt-1">
              <ScalableSelect
                options={facilitators.map((person) => ({
                  value: String(person.id),
                  label: person.name,
                }))}
                value={facilitatorId}
                onChange={setFacilitatorId}
                pinnedOption={{ value: "", label: "All facilitators" }}
                placeholder="All facilitators"
                searchPlaceholder="Search facilitators..."
                className="w-full"
                showSearch
                maxHeight={280}
                emptyMessage="No facilitators found"
              />
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Status
            <select
              value={cancelled}
              onChange={(event) => setCancelled(event.target.value as "" | "true" | "false")}
              className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
            >
              <option value="">Submitted and cancelled</option>
              <option value="false">Submitted</option>
              <option value="true">Cancelled</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canWrite && (
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              New report
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={exportExcel} disabled={reports.length === 0}>
            Export Excel
          </Button>
          <Button type="button" variant="secondary" onClick={exportPdf} disabled={reports.length === 0}>
            Export PDF
          </Button>
        </div>
      </Card>

      {error && <ErrorMessage message={error} />}
      {loading ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-600">No Bible study reports for this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Facilitators</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-3 py-3">{report.branch_name}</td>
                  <td className="px-3 py-3">{report.session_date}</td>
                  <td className="px-3 py-3">
                    {report.cancelled ? "Cancelled" : sessionTypeLabel(report.session_type)}
                  </td>
                  <td className="px-3 py-3">
                    {report.facilitator_details.map((row) => row.name).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3">{report.total_attendance}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="tertiary" onClick={() => setViewing(report)}>
                        View
                      </Button>
                      {canWrite && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditing(report);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button type="button" variant="tertiary" onClick={() => setDeleteId(report.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Sunday Bible Study Report" : "Sunday Bible Study Report"}
        closeOnOutsideClick={false}
      >
        <SundayBibleStudyReportForm
          report={editing}
          onCancel={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
        />
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title="Sunday Bible Study Report">
        {viewing && (
          <div className="space-y-3 text-sm text-gray-800">
            <p>
              <span className="font-medium">Branch:</span> {viewing.branch_name}
            </p>
            <p>
              <span className="font-medium">Date:</span> {viewing.session_date} · {viewing.year} week{" "}
              {viewing.week_number}
            </p>
            <p>
              <span className="font-medium">Session:</span>{" "}
              {viewing.cancelled ? `Cancelled — ${viewing.cancellation_reason}` : sessionTypeLabel(viewing.session_type)}
            </p>
            {!viewing.cancelled && (
              <>
                <p>
                  <span className="font-medium">Topic:</span> {viewing.topic}
                </p>
                <p>
                  <span className="font-medium">Scripture:</span> {viewing.scripture_reference}
                </p>
                <p>
                  <span className="font-medium">Flow:</span> {viewing.study_summary}
                </p>
                <p>
                  <span className="font-medium">Observation:</span> {viewing.observation}
                </p>
                <p>
                  <span className="font-medium">Attendance:</span> {viewing.member_count} members,{" "}
                  {viewing.first_time_count} first-time, {viewing.returning_count} returning,{" "}
                  {viewing.total_attendance} total
                </p>
                <ul className="space-y-2">
                  {viewing.visitor_details.map((visitor) => (
                    <li key={visitor.id} className="rounded-md border border-gray-200 p-2">
                      <p className="font-medium">{visitor.name}</p>
                      <p>Inviter: {visitor.inviter_name || "Walk-in"}</p>
                      {visitor.note && <p>Note: {visitor.note}</p>}
                    </li>
                  ))}
                </ul>
                {viewing.testimonies && <p>Testimonies: {viewing.testimonies}</p>}
                {viewing.prayer_requests && <p>Prayer requests: {viewing.prayer_requests}</p>}
                {viewing.notes && <p>Notes: {viewing.notes}</p>}
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return;
          try {
            await evangelismApi.deleteSundayBibleStudy(deleteId);
            toast.success("Report deleted");
            setDeleteId(null);
            void load();
          } catch (err) {
            console.error(err);
            toast.error("Could not delete the report.");
          }
        }}
        title="Delete this report?"
        message="This removes the Sunday Bible study report."
        confirmText="Delete"
      />
    </div>
  );
}
