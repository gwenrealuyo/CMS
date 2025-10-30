import { useState, useEffect, useRef } from "react";
import {
  ClusterWeeklyReport,
  Cluster,
  GatheringType,
  PersonUI,
  Person,
} from "@/src/types/person";
import { peopleApi } from "@/src/lib/api";
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
  const [formData, setFormData] = useState<Partial<ClusterWeeklyReport>>({
    cluster: cluster?.id || "",
    year: new Date().getFullYear(),
    week_number: getWeekNumber(new Date()),
    meeting_date: new Date().toISOString().split("T")[0],
    members_attended: [],
    visitors_attended: [],
    members_present: 0,
    visitors_present: 0,
    gathering_type: "PHYSICAL" as GatheringType,
    activities_held: "",
    prayer_requests: "",
    testimonies: "",
    offerings: 0,
    highlights: "",
    lowlights: "",
    ...initialData,
  });

  const [loading, setLoading] = useState(false);
  const [clusterSearchTerm, setClusterSearchTerm] = useState("");
  const [showClusterDropdown, setShowClusterDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<PersonUI[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);

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
        setPeople(peopleUI);
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

  const handleChange = (field: keyof ClusterWeeklyReport, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClusterSelect = (clusterId: string) => {
    handleChange("cluster", clusterId);
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
      const newVisitor: PersonUI = {
        ...response.data,
        name: `${response.data.first_name ?? ""} ${
          response.data.last_name ?? ""
        }`.trim(),
        dateFirstAttended: response.data.date_first_attended,
      };
      setPeople((prev) => [...prev, newVisitor]);

      // Automatically add to visitors_attended
      setFormData((prev) => ({
        ...prev,
        visitors_attended: [
          ...(prev.visitors_attended || []),
          response.data.id,
        ],
      }));

      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const handleMembersChange = (ids: string[]) => {
    setFormData((prev) => ({ ...prev, members_attended: ids }));
  };

  const handleVisitorsChange = (ids: string[]) => {
    setFormData((prev) => ({ ...prev, visitors_attended: ids }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            value={selectedClusterDisplay}
            onClick={() => setShowClusterDropdown(true)}
            readOnly
            placeholder="Select cluster..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
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
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {filteredClusters.length > 0 ? (
                filteredClusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    onClick={() => handleClusterSelect(cluster.id)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
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
      <div className="grid grid-cols-4 gap-4 mb-6">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            selectedIds={formData.members_attended || []}
            availablePeople={people}
            filterRole="MEMBER"
            onSelectionChange={handleMembersChange}
          />

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Visitors Attended
              </label>
              <button
                type="button"
                onClick={() => setShowAddVisitorModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-300 hover:border-blue-500 rounded-lg px-3 py-1.5 transition-colors"
              >
                + Add New Visitor
              </button>
            </div>
            <AttendanceSelector
              label=""
              selectedIds={formData.visitors_attended || []}
              availablePeople={people}
              filterRole="VISITOR"
              onSelectionChange={handleVisitorsChange}
              className="mb-0"
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
          value={formData.offerings === 0 ? "" : formData.offerings}
          onChange={(e) =>
            handleChange(
              "offerings",
              e.target.value === "" ? 0 : parseFloat(e.target.value)
            )
          }
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={onClose}
          variant="secondary"
          className="!text-black py-2 px-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
        >
          Cancel
        </Button>
        <Button
          onClick={() => handleSubmit(new Event("submit") as any)}
          disabled={loading}
          className="!text-white py-2 px-4 text-sm font-normal bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>{initialData ? "Update Report" : "Submit Report"}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
