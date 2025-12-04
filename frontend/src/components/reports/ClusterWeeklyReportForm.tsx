import { useState, useEffect, useRef } from "react";
import { PersonUI, Person } from "@/src/types/person";
import {
  ClusterWeeklyReport,
  Cluster,
  GatheringType,
} from "@/src/types/cluster";
import { peopleApi, clusterReportsApi } from "@/src/lib/api";
import Button from "@/src/components/ui/Button";
import AttendanceSelector from "./AttendanceSelector";
import AddVisitorModal from "./AddVisitorModal";

interface ClusterWeeklyReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ClusterWeeklyReport>) => Promise<void>;
  initialData?: Partial<ClusterWeeklyReport>;
  cluster?: Cluster | null;
  clusters: Cluster[];
}

export default function ClusterWeeklyReportForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  cluster,
  clusters,
}: ClusterWeeklyReportFormProps) {
  // Normalize IDs to numbers for consistency
  const normalizeIds = (ids: any[]): number[] => {
    if (!ids || !Array.isArray(ids)) return [];
    return ids
      .map((id) => {
        const numId = typeof id === "string" ? parseInt(id, 10) : id;
        return isNaN(numId) ? 0 : numId;
      })
      .filter((id) => id !== 0);
  };

  const [formData, setFormData] = useState<Partial<ClusterWeeklyReport>>({
    cluster: cluster?.id || 0,
    year: new Date().getFullYear(),
    week_number: getWeekNumber(new Date()),
    meeting_date: new Date().toISOString().split("T")[0],
    members_present: 0,
    visitors_present: 0,
    gathering_type: "PHYSICAL" as GatheringType,
    activities_held: "",
    prayer_requests: "",
    testimonies: "",
    offerings: "",
    highlights: "",
    lowlights: "",
    ...initialData,
    // Normalize IDs to numbers (override initialData if present)
    members_attended: (initialData?.members_attended || []).map((id) =>
      typeof id === "string" ? parseInt(id) : id
    ),
    visitors_attended: (initialData?.visitors_attended || []).map((id) =>
      typeof id === "string" ? parseInt(id) : id
    ),
  });

  const [loading, setLoading] = useState(false);
  const [clusterSearchTerm, setClusterSearchTerm] = useState("");
  const [showClusterDropdown, setShowClusterDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);
  const [previouslyAttendedVisitors, setPreviouslyAttendedVisitors] = useState<
    string[]
  >([]);
  const [mostRecentAttendedVisitors, setMostRecentAttendedVisitors] = useState<
    string[]
  >([]);
  const [previouslyAttendedMembers, setPreviouslyAttendedMembers] = useState<
    string[]
  >([]);
  const [mostRecentAttendedMembers, setMostRecentAttendedMembers] = useState<
    string[]
  >([]);

  // Fetch people data
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setLoadingPeople(true);
        const response = await peopleApi.getAll();
        const peopleUI: PersonUI[] = response.data.map((p) => {
          const middleInitial = p.middle_name
            ? ` ${p.middle_name.trim().charAt(0)}.`
            : "";
          const suffixPart =
            p.suffix && p.suffix.trim().length > 0 ? ` ${p.suffix.trim()}` : "";
          const name = `${p.first_name ?? ""}${middleInitial} ${
            p.last_name ?? ""
          }${suffixPart}`.trim();
          return {
            ...p,
            name,
            dateFirstAttended: p.date_first_attended,
          };
        });
        // Normalize people IDs to strings
        const normalizedPeopleUI = peopleUI.map((p) => ({
          ...p,
          id: p.id?.toString() || "",
        }));
        setPeople(normalizedPeopleUI);

        // Filter out invalid IDs from formData (visitors/members that were deleted)
        setFormData((prev) => {
          // Convert PersonUI.id (string) to numbers for comparison
          const validPeopleIds = new Set(
            normalizedPeopleUI
              .map((p) => {
                const numId =
                  typeof p.id === "string" ? parseInt(p.id, 10) : p.id;
                return isNaN(numId) ? 0 : numId;
              })
              .filter((id) => id !== 0)
          );

          // Ensure members_attended and visitors_attended are number arrays
          const normalizedMembers = (prev.members_attended || []).map((id) => {
            const numId =
              typeof id === "string" ? parseInt(String(id), 10) : id;
            return isNaN(numId) ? 0 : numId;
          });
          const normalizedVisitors = (prev.visitors_attended || []).map(
            (id) => {
              const numId =
                typeof id === "string" ? parseInt(String(id), 10) : id;
              return isNaN(numId) ? 0 : numId;
            }
          );

          const validMembers = normalizedMembers.filter(
            (id) => validPeopleIds.has(id) && id !== 0
          );
          const validVisitors = normalizedVisitors.filter(
            (id) => validPeopleIds.has(id) && id !== 0
          );

          // Only update if there were invalid IDs removed or IDs needed normalization
          if (
            validMembers.length !== normalizedMembers.length ||
            validVisitors.length !== normalizedVisitors.length ||
            JSON.stringify(validMembers) !==
              JSON.stringify(prev.members_attended) ||
            JSON.stringify(validVisitors) !==
              JSON.stringify(prev.visitors_attended)
          ) {
            return {
              ...prev,
              members_attended: validMembers,
              visitors_attended: validVisitors,
            };
          }
          return prev;
        });
      } catch (error) {
        console.error("Error fetching people:", error);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  // Filter clusters based on search term
  const filteredClusters = clusters.filter((cluster) => {
    const searchLower = clusterSearchTerm.toLowerCase();
    return (
      cluster.name?.toLowerCase().includes(searchLower) ||
      (cluster.code && cluster.code.toLowerCase().includes(searchLower))
    );
  });

  // Get selected cluster name for display
  const selectedCluster = clusters.find((c) => c.id === formData.cluster);
  const selectedClusterDisplay = selectedCluster
    ? selectedCluster.code
      ? `${selectedCluster.code} - ${selectedCluster.name}`
      : selectedCluster.name
    : "";

  // Helper function to get week number
  function getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor(
      (date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    );
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  useEffect(() => {
    if (cluster) {
      setFormData((prev) => ({ ...prev, cluster: cluster.id }));
    }
  }, [cluster]);

  // Update formData when initialData changes (when editing)
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        year: initialData.year ?? prev.year,
        week_number: initialData.week_number ?? prev.week_number,
        cluster: initialData.cluster ?? prev.cluster,
      }));
    }
  }, [initialData?.id, initialData?.year, initialData?.week_number]);

  // Fetch previously attended visitors and members when cluster is selected
  useEffect(() => {
    const fetchPreviousAttendance = async () => {
      if (selectedCluster) {
        try {
          // Get current report's year and week to filter previous reports
          // When editing (initialData exists), ALWAYS use initialData's week/year
          // When creating new, use formData or defaults
          // This ensures we get the correct previous reports even when dashboard filters are active
          const currentYear = Number(
            initialData?.year ?? formData.year ?? new Date().getFullYear()
          );
          const currentWeek = Number(
            initialData?.week_number ??
              formData.week_number ??
              getWeekNumber(new Date())
          );
          const currentReportId = initialData?.id?.toString();

          // Fetch all previous reports for this cluster
          // We'll filter client-side to only get reports from earlier weeks/years
          const response = await clusterReportsApi.getAll({
            cluster: selectedCluster.id.toString(),
            page_size: 100, // Get all reports to collect all unique visitors/members
          });

          // Collect all unique visitor IDs from all previous reports of this cluster
          const visitorIds = new Set<string>();
          // Collect all unique member IDs from all previous reports of this cluster
          const memberIds = new Set<string>();

          // Track the most recent report (before current week)
          let mostRecentReport: any = null;

          if (response.data.results && response.data.results.length > 0) {
            response.data.results.forEach((report) => {
              // Skip the current report if editing
              if (
                currentReportId &&
                report.id?.toString() === currentReportId
              ) {
                return;
              }

              // Only include reports from earlier weeks/years
              // Ensure week_number and year are numbers for proper comparison
              const reportYear = Number(report.year || 0);
              const reportWeek = Number(report.week_number || 0);

              // Include if: earlier year (any week), OR same year but earlier week
              // This ensures we get all historical data from before the current report
              const isPreviousReport =
                reportYear < currentYear ||
                (reportYear === currentYear && reportWeek < currentWeek);

              if (
                report.cluster?.toString() === selectedCluster.id.toString() &&
                isPreviousReport
              ) {
                // Collect all unique visitors/members from previous reports
                if (report.visitors_attended) {
                  report.visitors_attended.forEach((id: number) => {
                    visitorIds.add(id.toString());
                  });
                }
                if (report.members_attended) {
                  report.members_attended.forEach((id: number) => {
                    memberIds.add(id.toString());
                  });
                }

                // Track the most recent report (highest week in same year, or latest year)
                if (!mostRecentReport) {
                  mostRecentReport = report;
                } else {
                  const mostRecentYear = mostRecentReport.year || 0;
                  const mostRecentWeek = mostRecentReport.week_number || 0;

                  if (
                    reportYear > mostRecentYear ||
                    (reportYear === mostRecentYear &&
                      reportWeek > mostRecentWeek)
                  ) {
                    mostRecentReport = report;
                  }
                }
              }
            });
          }

          // For auto-selection, use only the most recent report's visitors/members
          const mostRecentVisitorIds: string[] =
            mostRecentReport?.visitors_attended
              ? Array.from(
                  new Set(
                    mostRecentReport.visitors_attended.map((id: number) =>
                      id.toString()
                    )
                  )
                )
              : [];
          const mostRecentMemberIds: string[] =
            mostRecentReport?.members_attended
              ? Array.from(
                  new Set(
                    mostRecentReport.members_attended.map((id: number) =>
                      id.toString()
                    )
                  )
                )
              : [];

          // Store all previously attended visitors/members for filtering the list
          setPreviouslyAttendedVisitors(Array.from(visitorIds));
          setPreviouslyAttendedMembers(Array.from(memberIds));

          // Store most recent visitors/members for auto-selection
          setMostRecentAttendedVisitors(mostRecentVisitorIds);
          setMostRecentAttendedMembers(mostRecentMemberIds);
        } catch (error) {
          console.error("Error fetching previous attendance:", error);
          setPreviouslyAttendedVisitors([]);
          setMostRecentAttendedVisitors([]);
          setPreviouslyAttendedMembers([]);
          setMostRecentAttendedMembers([]);
        }
      } else {
        setPreviouslyAttendedVisitors([]);
        setMostRecentAttendedVisitors([]);
        setPreviouslyAttendedMembers([]);
        setMostRecentAttendedMembers([]);
      }
    };

    fetchPreviousAttendance();
  }, [
    selectedCluster?.id,
    initialData?.year,
    initialData?.week_number,
    initialData?.id,
    formData.year,
    formData.week_number,
  ]);

  const handleChange = (field: keyof ClusterWeeklyReport, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClusterSelect = (clusterId: number | string) => {
    const numId =
      typeof clusterId === "string" ? parseInt(clusterId, 10) : clusterId;
    handleChange("cluster", numId);
    setShowClusterDropdown(false);
    setClusterSearchTerm("");
  };

  const handleClusterSearchChange = (value: string) => {
    setClusterSearchTerm(value);
    setShowClusterDropdown(true);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowClusterDropdown(false);
      }
    };

    if (showClusterDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showClusterDropdown]);

  const handleCreateVisitor = async (visitorData: Partial<Person>) => {
    try {
      const response = await peopleApi.create(visitorData);
      const middleInitial = response.data.middle_name
        ? ` ${response.data.middle_name.trim().charAt(0)}.`
        : "";
      const suffixPart =
        response.data.suffix && response.data.suffix.trim().length > 0
          ? ` ${response.data.suffix.trim()}`
          : "";
      const name = `${response.data.first_name ?? ""}${middleInitial} ${
        response.data.last_name ?? ""
      }${suffixPart}`.trim();

      const newVisitor: PersonUI = {
        ...response.data,
        name,
        dateFirstAttended: response.data.date_first_attended,
      };

      // Update people list with the new visitor
      setPeople((prev) => [...prev, newVisitor]);

      // Automatically add to visitors_attended
      setFormData((prev) => ({
        ...prev,
        visitors_attended: [
          ...(prev.visitors_attended || [])
            .map((id) =>
              typeof id === "string" ? parseInt(String(id), 10) : id
            )
            .filter((id) => !isNaN(id)),
          typeof response.data.id === "string"
            ? parseInt(response.data.id, 10)
            : response.data.id,
        ].filter((id) => !isNaN(id)) as number[],
      }));

      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const handleMembersChange = (ids: string[]) => {
    const numIds = ids
      .map((id) => (typeof id === "string" ? parseInt(id, 10) : id))
      .filter((id) => !isNaN(id)) as number[];
    setFormData((prev) => ({ ...prev, members_attended: numIds }));
  };

  const handleVisitorsChange = (ids: string[]) => {
    const numIds = ids
      .map((id) => (typeof id === "string" ? parseInt(id, 10) : id))
      .filter((id) => !isNaN(id)) as number[];
    setFormData((prev) => ({ ...prev, visitors_attended: numIds }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't submit if the add visitor modal is open
    if (showAddVisitorModal) {
      return;
    }
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Prevent Enter key from submitting form when modal is open
        if (e.key === "Enter" && showAddVisitorModal) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="max-h-[85vh] overflow-y-auto text-sm max-w-3xl"
    >
      {/* Cluster Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cluster *
        </label>
        <div className="relative" ref={dropdownRef}>
          <input
            type="text"
            value={selectedClusterDisplay || ""}
            onClick={() => setShowClusterDropdown(true)}
            readOnly
            placeholder="Select cluster..."
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            required
          />
          {showClusterDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                <input
                  type="text"
                  value={clusterSearchTerm}
                  onChange={(e) => handleClusterSearchChange(e.target.value)}
                  placeholder="Search clusters..."
                  className="w-full px-2 py-1.5 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {filteredClusters.length > 0 ? (
                filteredClusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    onClick={() => handleClusterSelect(cluster.id)}
                    className="w-full px-3 py-2 min-h-[44px] text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="font-medium text-gray-900">
                      {cluster.code
                        ? `${cluster.code} - ${cluster.name}`
                        : cluster.name}
                    </div>
                    {cluster.location && (
                      <div className="text-sm text-gray-500">
                        {cluster.location}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No clusters found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Basic Information Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Year *
          </label>
          <input
            type="number"
            value={formData.year || ""}
            onChange={(e) => handleChange("year", parseInt(e.target.value))}
            min="2020"
            max="2030"
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Week Number *
          </label>
          <input
            type="number"
            value={formData.week_number || ""}
            onChange={(e) =>
              handleChange("week_number", parseInt(e.target.value))
            }
            min="1"
            max="53"
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meeting Date *
          </label>
          <input
            type="date"
            value={formData.meeting_date || ""}
            onChange={(e) => handleChange("meeting_date", e.target.value)}
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gathering Type *
          </label>
          <select
            value={formData.gathering_type || "PHYSICAL"}
            onChange={(e) =>
              handleChange("gathering_type", e.target.value as GatheringType)
            }
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="PHYSICAL">Physical</option>
            <option value="ONLINE">Online</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
      </div>

      {/* Attendance Selection */}
      {loadingPeople ? (
        <div className="mb-6 text-center py-8 text-gray-500">
          Loading people data...
        </div>
      ) : (
        <>
          <AttendanceSelector
            label="Members Attended"
            selectedIds={(formData.members_attended || []).map((id) =>
              String(id)
            )}
            availablePeople={people}
            filterRole="MEMBER"
            onSelectionChange={handleMembersChange}
            selectedCluster={(selectedCluster as any) || undefined}
            previouslyAttendedIds={previouslyAttendedMembers}
            mostRecentAttendedIds={mostRecentAttendedMembers}
          />

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Visitors Attended
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setShowAddVisitorModal(true);
                  return false;
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-300 hover:border-blue-500 rounded-lg px-3 py-1.5 transition-colors"
              >
                + Add New Visitor
              </button>
            </div>
            <AttendanceSelector
              label=""
              selectedIds={(formData.visitors_attended || []).map((id) =>
                String(id)
              )}
              availablePeople={people}
              filterRole="VISITOR"
              onSelectionChange={handleVisitorsChange}
              className="mb-0"
              selectedCluster={(selectedCluster as any) || undefined}
              previouslyAttendedIds={previouslyAttendedVisitors}
              mostRecentAttendedIds={mostRecentAttendedVisitors}
            />
          </div>
        </>
      )}

      {/* Offerings */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Offerings (₱)
        </label>
        <input
          type="number"
          step="0.01"
          value={
            formData.offerings === "" || formData.offerings === "0"
              ? ""
              : String(formData.offerings)
          }
          onChange={(e) =>
            handleChange(
              "offerings",
              e.target.value === "" ? 0 : parseFloat(e.target.value)
            )
          }
          min="0"
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Add Visitor Modal */}
      <AddVisitorModal
        isOpen={showAddVisitorModal}
        onClose={() => setShowAddVisitorModal(false)}
        onAdd={handleCreateVisitor}
      />

      {/* Activities and Content */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Activities Held
        </label>
        <textarea
          value={formData.activities_held || ""}
          onChange={(e) => handleChange("activities_held", e.target.value)}
          rows={3}
          placeholder="Describe activities or events held during the cluster meeting..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prayer Requests
        </label>
        <textarea
          value={formData.prayer_requests || ""}
          onChange={(e) => handleChange("prayer_requests", e.target.value)}
          rows={3}
          placeholder="List prayer requests shared during the meeting..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Testimonies
        </label>
        <textarea
          value={formData.testimonies || ""}
          onChange={(e) => handleChange("testimonies", e.target.value)}
          rows={3}
          placeholder="Share testimonies or encouraging stories from members..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Highlights and Lowlights */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Highlights
        </label>
        <textarea
          value={formData.highlights || ""}
          onChange={(e) => handleChange("highlights", e.target.value)}
          rows={3}
          placeholder="Positive events, achievements, or encouraging moments..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lowlights
        </label>
        <textarea
          value={formData.lowlights || ""}
          onChange={(e) => handleChange("lowlights", e.target.value)}
          rows={3}
          placeholder="Challenges, concerns, or areas needing attention..."
          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button className="w-full sm:flex-1 min-h-[44px]" disabled={loading} type="submit">
          {loading
            ? "Saving..."
            : initialData
            ? "Update Report"
            : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
