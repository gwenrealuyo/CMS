"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import {
  equipmentBookingsApi,
  vehicleBookingsApi,
  vehiclesApi,
} from "@/src/lib/api";
import {
  EquipmentBooking,
  FacilityBookingStatus,
  Vehicle,
  VehicleBooking,
} from "@/src/types/facilities";

type FacilitiesBookingsPanelProps = {
  mode: "equipment" | "vehicle";
  canManage: boolean;
  canRequest: boolean;
  pendingOnly?: boolean;
  /** When provided, uses the page-level branch filter (hides the local picker). */
  branchId?: number | "";
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${month} ${day}, ${year}, ${time}`;
}

function formatTimeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameLocalDay(a: string, b: string) {
  const start = new Date(a);
  const end = new Date(b);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  return (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  );
}

function formatDateTimeRange(start: string, end: string) {
  if (isSameLocalDay(start, end)) {
    return `${formatDateTime(start)} → ${formatTimeOnly(end)}`;
  }
  return `${formatDateTime(start)} → ${formatDateTime(end)}`;
}

function BookingStatusBadge({ status }: { status: FacilityBookingStatus }) {
  const styles: Record<FacilityBookingStatus, string> = {
    pending:
      "bg-amber-50 text-amber-800 border-amber-200",
    approved:
      "bg-emerald-50 text-emerald-800 border-emerald-200",
    rejected:
      "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<FacilityBookingStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function FacilitiesBookingsPanel({
  mode,
  canManage,
  canRequest,
  pendingOnly = false,
  branchId: controlledBranchId,
}: FacilitiesBookingsPanelProps) {
  const { user } = useAuth();
  const { branches } = useBranches();
  const canPickBranch = Boolean(user?.can_see_all_branches);
  const isBranchControlled = controlledBranchId !== undefined;
  const [branchId, setBranchId] = useState<number | "">(
    controlledBranchId !== undefined
      ? controlledBranchId
      : user?.branch != null
        ? Number(user.branch)
        : "",
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [equipmentBookings, setEquipmentBookings] = useState<
    EquipmentBooking[]
  >([]);
  const [vehicleBookings, setVehicleBookings] = useState<VehicleBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<
    EquipmentBooking | VehicleBooking | null
  >(null);

  const [vTitle, setVTitle] = useState("");
  const [vStart, setVStart] = useState("");
  const [vEnd, setVEnd] = useState("");
  const [vVehicleId, setVVehicleId] = useState<number | "">("");
  const [vPreferred, setVPreferred] = useState<number | "">("");
  const [assignDriverId, setAssignDriverId] = useState<number | "">("");
  const [tripLeg, setTripLeg] = useState<"out" | "in">("out");
  const [tripOdo, setTripOdo] = useState("");
  const [tripRfid, setTripRfid] = useState("");

  const effectiveBranch = branchId === "" ? null : Number(branchId);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === Number(vVehicleId)) ?? null,
    [vehicles, vVehicleId],
  );

  const load = useCallback(async () => {
    if (effectiveBranch == null) return;
    setLoading(true);
    try {
      if (mode === "equipment") {
        const bookRes = await equipmentBookingsApi.list({
          branch: effectiveBranch,
          ...(pendingOnly ? { booking_status: "pending" } : {}),
        });
        setEquipmentBookings(bookRes.data as EquipmentBooking[]);
      } else {
        const [vehRes, bookRes] = await Promise.all([
          vehiclesApi.list({ branch: effectiveBranch, is_active: true }),
          vehicleBookingsApi.list({
            branch: effectiveBranch,
            ...(pendingOnly ? { booking_status: "pending" } : {}),
          }),
        ]);
        setVehicles(vehRes.data as Vehicle[]);
        setVehicleBookings(bookRes.data as VehicleBooking[]);
      }
    } catch {
      toast.error("Failed to load facilities data.");
    } finally {
      setLoading(false);
    }
  }, [effectiveBranch, mode, pendingOnly]);

  useEffect(() => {
    if (isBranchControlled) {
      setBranchId(controlledBranchId ?? "");
      return;
    }
    if (!canPickBranch && user?.branch != null) {
      setBranchId(Number(user.branch));
    }
  }, [isBranchControlled, controlledBranchId, canPickBranch, user?.branch]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitVehicle = async () => {
    if (!vTitle.trim() || !vStart || !vEnd || vVehicleId === "") {
      toast.error("Purpose, vehicle, start, and end are required.");
      return;
    }
    try {
      await vehicleBookingsApi.create({
        title: vTitle.trim(),
        vehicle: Number(vVehicleId),
        start_date: new Date(vStart).toISOString(),
        end_date: new Date(vEnd).toISOString(),
        preferred_driver: vPreferred === "" ? null : Number(vPreferred),
      });
      toast.success(
        canManage
          ? "Vehicle booking created."
          : "Booking submitted for approval.",
      );
      setFormOpen(false);
      setVTitle("");
      setVPreferred("");
      await load();
    } catch (error: unknown) {
      const message =
        (
          error as {
            response?: {
              data?: { message?: string; details?: { vehicle?: string[] } };
            };
          }
        )?.response?.data?.details?.vehicle?.[0] ||
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "Failed to create vehicle booking.";
      toast.error(String(message));
    }
  };

  const bookings = mode === "equipment" ? equipmentBookings : vehicleBookings;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        {canPickBranch && !isBranchControlled ? (
          <div className="w-full sm:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              value={branchId}
              onChange={(e) =>
                setBranchId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg"
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {mode === "vehicle" && (canManage || canRequest) && (
          <Button
            onClick={() => setFormOpen(true)}
            className="w-full sm:w-auto min-h-[44px]"
            disabled={effectiveBranch == null}
          >
            Book vehicle
          </Button>
        )}
      </div>

      {isBranchControlled && effectiveBranch == null ? (
        <p className="text-sm text-gray-500">
          Select a branch above to view vehicle bookings.
        </p>
      ) : null}

      {mode === "equipment" && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Borrow equipment from the event booking form when the event uses a
          room in the church building. This list is for review, approval, and
          handoff.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500">No bookings yet.</p>
      ) : mode === "vehicle" ? (
        <VehicleBookingsTable
          bookings={vehicleBookings}
          onOpen={(booking) => {
            setAssignDriverId(
              booking.assigned_driver != null
                ? Number(booking.assigned_driver)
                : "",
            );
            setDetail(booking);
          }}
        />
      ) : (
        <div className="divide-y border border-gray-200 rounded-lg bg-white">
          {equipmentBookings.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => setDetail(booking)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">
                  {booking.title}
                </span>
                <BookingStatusBadge status={booking.booking_status} />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {booking.event_title
                  ? `${booking.event_title}${
                      booking.event_room_name
                        ? ` · ${booking.event_room_name}`
                        : ""
                    } · `
                  : ""}
                {formatDateTimeRange(booking.start_date, booking.end_date)}
              </div>
              {booking.created_by_name ? (
                <div className="text-xs text-gray-500 mt-1">
                  Requested by {booking.created_by_name}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {mode === "vehicle" && (
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title="Book vehicle"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose *
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                placeholder="e.g., Cluster outing, transport guests"
                value={vTitle}
                onChange={(e) => setVTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                value={vVehicleId}
                onChange={(e) => {
                  setVVehicleId(e.target.value ? Number(e.target.value) : "");
                  setVPreferred("");
                }}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start *
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                  value={vStart}
                  onChange={(e) => setVStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End *
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                  value={vEnd}
                  onChange={(e) => setVEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred driver
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                value={vPreferred}
                onChange={(e) =>
                  setVPreferred(e.target.value ? Number(e.target.value) : "")
                }
                disabled={!selectedVehicle}
              >
                <option value="">Optional</option>
                {(selectedVehicle?.drivers || []).map((d) => (
                  <option key={d.id} value={d.person}>
                    {d.person_name || d.person}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Preference only — church admin assigns the final driver.
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={submitVehicle} className="min-h-[44px]">
                Submit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={
          mode === "vehicle" && detail
            ? (detail as VehicleBooking).title || "Vehicle booking"
            : detail?.title || "Booking"
        }
      >
        {detail && mode === "equipment" && (
          <EquipmentDetail
            booking={detail as EquipmentBooking}
            canManage={canManage}
            onChanged={async () => {
              await load();
              setDetail(null);
            }}
          />
        )}
        {detail && mode === "vehicle" && (
          <VehicleDetail
            booking={detail as VehicleBooking}
            vehicles={vehicles}
            canManage={canManage}
            assignDriverId={assignDriverId}
            setAssignDriverId={setAssignDriverId}
            tripLeg={tripLeg}
            setTripLeg={setTripLeg}
            tripOdo={tripOdo}
            setTripOdo={setTripOdo}
            tripRfid={tripRfid}
            setTripRfid={setTripRfid}
            onChanged={async () => {
              await load();
              setDetail(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function VehicleBookingsTable({
  bookings,
  onOpen,
}: {
  bookings: VehicleBooking[];
  onOpen: (booking: VehicleBooking) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="hidden md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <span>Purpose</span>
        <span>Vehicle</span>
        <span>Schedule</span>
        <span>People</span>
        <span className="text-right">Status</span>
      </div>
      <div className="divide-y divide-gray-100">
        {bookings.map((booking) => (
          <button
            key={booking.id}
            type="button"
            onClick={() => onOpen(booking)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {booking.title}
              </div>
              <div className="md:hidden mt-1">
                <BookingStatusBadge status={booking.booking_status} />
              </div>
            </div>
            <div className="text-sm text-gray-700 truncate">
              <span className="md:hidden text-xs text-gray-500 mr-1">
                Vehicle:
              </span>
              {booking.vehicle_name || "—"}
            </div>
            <div className="text-sm text-gray-600">
              {formatDateTimeRange(booking.start_date, booking.end_date)}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5 min-w-0">
              <div className="truncate">
                <span className="text-gray-400">Requested</span>{" "}
                {booking.created_by_name || "—"}
              </div>
              <div className="truncate">
                <span className="text-gray-400">Driver</span>{" "}
                {booking.assigned_driver_name ||
                  booking.preferred_driver_name ||
                  "—"}
                {!booking.assigned_driver_name &&
                booking.preferred_driver_name
                  ? " (pref.)"
                  : ""}
              </div>
            </div>
            <div className="hidden md:flex md:justify-end">
              <BookingStatusBadge status={booking.booking_status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EquipmentDetail({
  booking,
  canManage,
  onChanged,
}: {
  booking: EquipmentBooking;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <BookingStatusBadge status={booking.booking_status} />
        {booking.event_title ? (
          <span>
            {booking.event_title}
            {booking.event_room_name ? ` · ${booking.event_room_name}` : ""}
          </span>
        ) : null}
      </div>
      <ul className="space-y-3">
        {booking.items.map((item) => (
          <li key={item.id} className="border rounded-lg p-3 text-sm space-y-2">
            <div className="font-medium">
              {item.equipment_type_name} × {item.quantity}
            </div>
            {item.requester_remarks ? (
              <p className="text-gray-600">Remarks: {item.requester_remarks}</p>
            ) : null}
            <p className="text-xs text-gray-500">
              Received:{" "}
              {item.received_at
                ? `${item.received_condition || "—"} (${new Date(item.received_at).toLocaleString()})`
                : "—"}
            </p>
            <p className="text-xs text-gray-500">
              Returned:{" "}
              {item.returned_at
                ? `${item.returned_condition || "—"} (${new Date(item.returned_at).toLocaleString()})`
                : "—"}
            </p>
            {canManage && booking.booking_status === "approved" && (
              <div className="flex flex-wrap gap-2">
                {!item.received_at && (
                  <Button
                    type="button"
                    variant="tertiary"
                    className="min-h-[44px]"
                    onClick={async () => {
                      try {
                        await equipmentBookingsApi.handoff(
                          booking.id,
                          item.id,
                          {
                            mark_received: true,
                            received_condition: "ok",
                          },
                        );
                        toast.success("Marked received.");
                        await onChanged();
                      } catch {
                        toast.error("Failed to record receive.");
                      }
                    }}
                  >
                    Mark received OK
                  </Button>
                )}
                {item.received_at && !item.returned_at && (
                  <Button
                    type="button"
                    variant="tertiary"
                    className="min-h-[44px]"
                    onClick={async () => {
                      try {
                        await equipmentBookingsApi.handoff(
                          booking.id,
                          item.id,
                          {
                            mark_returned: true,
                            returned_condition: "ok",
                          },
                        );
                        toast.success("Marked returned.");
                        await onChanged();
                      } catch {
                        toast.error("Failed to record return.");
                      }
                    }}
                  >
                    Mark returned OK
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && booking.booking_status === "pending" && (
        <div className="flex gap-2">
          <Button
            className="min-h-[44px]"
            onClick={async () => {
              try {
                await equipmentBookingsApi.approve(booking.id);
                toast.success("Approved.");
                await onChanged();
              } catch {
                toast.error("Failed to approve.");
              }
            }}
          >
            Approve
          </Button>
          <Button
            variant="tertiary"
            className="min-h-[44px]"
            onClick={async () => {
              try {
                await equipmentBookingsApi.reject(booking.id);
                toast.success("Rejected.");
                await onChanged();
              } catch {
                toast.error("Failed to reject.");
              }
            }}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function tripFieldsForLeg(
  booking: VehicleBooking,
  leg: "out" | "in",
): { odo: string; rfid: string; existing: boolean } {
  const log = (booking.trip_logs || []).find((row) => row.leg === leg);
  if (!log) {
    return { odo: "", rfid: "", existing: false };
  }
  return {
    odo: String(log.odometer ?? ""),
    rfid: String(log.rfid_balance ?? ""),
    existing: true,
  };
}

function VehicleDetail({
  booking,
  vehicles,
  canManage,
  assignDriverId,
  setAssignDriverId,
  tripLeg,
  setTripLeg,
  tripOdo,
  setTripOdo,
  tripRfid,
  setTripRfid,
  onChanged,
}: {
  booking: VehicleBooking;
  vehicles: Vehicle[];
  canManage: boolean;
  assignDriverId: number | "";
  setAssignDriverId: (v: number | "") => void;
  tripLeg: "out" | "in";
  setTripLeg: (v: "out" | "in") => void;
  tripOdo: string;
  setTripOdo: (v: string) => void;
  tripRfid: string;
  setTripRfid: (v: string) => void;
  onChanged: () => Promise<void>;
}) {
  const vehicle =
    vehicles.find((v) => v.id === booking.vehicle) ||
    ({
      id: booking.vehicle,
      name: booking.vehicle_name,
      drivers: [],
    } as Partial<Vehicle>);

  const tripLogKey = useMemo(
    () =>
      (booking.trip_logs || [])
        .map((log) => `${log.leg}:${log.odometer}:${log.rfid_balance}`)
        .join("|"),
    [booking.trip_logs],
  );

  const applyTripLeg = (leg: "out" | "in") => {
    const fields = tripFieldsForLeg(booking, leg);
    setTripLeg(leg);
    setTripOdo(fields.odo);
    setTripRfid(fields.rfid);
  };

  useEffect(() => {
    const fields = tripFieldsForLeg(booking, tripLeg);
    setTripOdo(fields.odo);
    setTripRfid(fields.rfid);
    // booking is read for trip_logs; tripLogKey tracks content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid resetting while typing
  }, [booking.id, tripLogKey, tripLeg, setTripOdo, setTripRfid]);

  const editingExistingTrip = Boolean(
    (booking.trip_logs || []).some((log) => log.leg === tripLeg),
  );
  const outLog = (booking.trip_logs || []).find((log) => log.leg === "out");
  const inLog = (booking.trip_logs || []).find((log) => log.leg === "in");

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-gray-900">
            {booking.vehicle_name || "Vehicle"}
          </div>
          <BookingStatusBadge status={booking.booking_status} />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Schedule
            </dt>
            <dd className="mt-0.5 text-gray-800">
              {formatDateTimeRange(booking.start_date, booking.end_date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Requested by
            </dt>
            <dd className="mt-0.5 text-gray-800">
              {booking.created_by_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Preferred driver
            </dt>
            <dd className="mt-0.5 text-gray-800">
              {booking.preferred_driver_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Assigned driver
            </dt>
            <dd className="mt-0.5 text-gray-800">
              {booking.assigned_driver_name || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Trip logs</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              ["out", "Out", outLog],
              ["in", "In", inLog],
            ] as const
          ).map(([leg, label, log]) => (
            <div
              key={leg}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                </span>
                {log ? (
                  <span className="text-[11px] font-medium text-emerald-700">
                    Recorded
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400">Not recorded</span>
                )}
              </div>
              {log ? (
                <div className="mt-1.5 text-sm text-gray-700 space-y-0.5">
                  <div>Odometer: {log.odometer}</div>
                  <div>RFID: {log.rfid_balance}</div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">No values yet.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {canManage && booking.booking_status === "pending" && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
          <Button
            variant="tertiary"
            className="min-h-[44px]"
            onClick={async () => {
              try {
                await vehicleBookingsApi.reject(booking.id);
                toast.success("Rejected.");
                await onChanged();
              } catch {
                toast.error("Failed to reject.");
              }
            }}
          >
            Reject
          </Button>
          <Button
            className="min-h-[44px]"
            onClick={async () => {
              try {
                await vehicleBookingsApi.approve(booking.id);
                toast.success("Approved.");
                await onChanged();
              } catch {
                toast.error("Failed to approve.");
              }
            }}
          >
            Approve
          </Button>
        </div>
      )}

      {canManage && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              Assign final driver
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose from this vehicle&apos;s allowlist.
            </p>
          </div>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
            value={assignDriverId}
            onChange={(e) =>
              setAssignDriverId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Select driver</option>
            {(vehicle.drivers || []).map((d) => (
              <option key={d.id} value={d.person}>
                {d.person_name || d.person}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <Button
              className="min-h-[44px]"
              onClick={async () => {
                try {
                  await vehicleBookingsApi.assignDriver(booking.id, {
                    assigned_driver:
                      assignDriverId === "" ? null : Number(assignDriverId),
                  });
                  toast.success("Driver assigned.");
                  await onChanged();
                } catch {
                  toast.error("Failed to assign driver.");
                }
              }}
            >
              Save assigned driver
            </Button>
          </div>
        </div>
      )}

      {canManage && booking.booking_status === "approved" && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              {editingExistingTrip ? "Edit trip log" : "Record trip log"}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Switching Out/In loads any saved values for that leg.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leg
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
              value={tripLeg}
              onChange={(e) => applyTripLeg(e.target.value as "out" | "in")}
            >
              <option value="out">Out</option>
              <option value="in">In</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="vehicle-trip-odometer"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Odometer
              </label>
              <input
                id="vehicle-trip-odometer"
                type="number"
                inputMode="numeric"
                placeholder="e.g., 12500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                value={tripOdo}
                onChange={(e) => setTripOdo(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="vehicle-trip-rfid"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                RFID balance
              </label>
              <input
                id="vehicle-trip-rfid"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g., 450.50"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                value={tripRfid}
                onChange={(e) => setTripRfid(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              className="min-h-[44px]"
              onClick={async () => {
                try {
                  await vehicleBookingsApi.createTripLog(booking.id, {
                    leg: tripLeg,
                    odometer: Number(tripOdo),
                    rfid_balance: tripRfid,
                  });
                  toast.success(
                    editingExistingTrip
                      ? "Trip log updated."
                      : "Trip log saved.",
                  );
                  await onChanged();
                } catch {
                  toast.error("Failed to save trip log.");
                }
              }}
            >
              {editingExistingTrip ? "Update trip log" : "Save trip log"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
