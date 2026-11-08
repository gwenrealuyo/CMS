export type FacilityBookingStatus = "pending" | "approved" | "rejected";

export type EquipmentCondition = "ok" | "damaged" | "missing" | "other" | "";

export interface EquipmentType {
  id: number;
  branch: number;
  branch_name?: string | null;
  name: string;
  quantity_available: number;
  notes?: string;
  is_active: boolean;
  sort_order: number;
}

export interface EquipmentBookingItem {
  id: number;
  equipment_type: number;
  equipment_type_name?: string;
  quantity: number;
  requester_remarks?: string;
  received_at?: string | null;
  received_condition?: EquipmentCondition;
  received_notes?: string;
  returned_at?: string | null;
  returned_condition?: EquipmentCondition;
  returned_notes?: string;
  handoff_by?: number | null;
}

export interface EquipmentBooking {
  id: number;
  title: string;
  event: number | string;
  event_title?: string;
  event_room_name?: string | null;
  branch: number;
  branch_name?: string | null;
  start_date: string;
  end_date: string;
  notes?: string;
  booking_status: FacilityBookingStatus;
  items: EquipmentBookingItem[];
  created_by?: number | null;
  created_by_name?: string | null;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleDriver {
  id: number;
  vehicle: number;
  person: number;
  person_name?: string;
}

export interface Vehicle {
  id: number;
  branch: number;
  branch_name?: string | null;
  name: string;
  is_active: boolean;
  notes?: string;
  last_odometer?: number | null;
  last_rfid_balance?: string | number | null;
  sort_order: number;
  drivers?: VehicleDriver[];
}

export interface VehicleTripLog {
  id: number;
  booking: number;
  leg: "out" | "in";
  odometer: number;
  rfid_balance: string | number;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  recorded_at?: string;
  notes?: string;
}

export interface VehicleBooking {
  id: number;
  title: string;
  vehicle: number;
  vehicle_name?: string;
  start_date: string;
  end_date: string;
  notes?: string;
  preferred_driver?: number | null;
  preferred_driver_name?: string | null;
  assigned_driver?: number | null;
  assigned_driver_name?: string | null;
  booking_status: FacilityBookingStatus;
  trip_logs?: VehicleTripLog[];
  created_by?: number | null;
  created_by_name?: string | null;
  reviewed_at?: string | null;
  review_note?: string;
  created_at?: string;
}
