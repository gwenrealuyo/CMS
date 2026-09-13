"use client";

import SearchableSelect, {
  type SearchableOption,
} from "@/src/components/ui/SearchableSelect";
import {
  FORMER_NOT_IN_SYSTEM_LABEL,
  NOT_SURE_OPTION_LABEL,
  type VerifierEntryMode,
} from "@/src/lib/baptismVerifiers";

type BaptismVerifierPickerProps = {
  label: string;
  hint?: string | null;
  mode: VerifierEntryMode;
  onModeChange: (mode: VerifierEntryMode) => void;
  personId: string;
  onPersonIdChange: (value: string) => void;
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  options: SearchableOption[];
  emptyMessage: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  radioName: string;
  requireHistoricalNames?: boolean;
  showClusterCodes?: boolean;
};

export default function BaptismVerifierPicker({
  label,
  hint,
  mode,
  onModeChange,
  personId,
  onPersonIdChange,
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  options,
  emptyMessage,
  emptyOptionLabel = NOT_SURE_OPTION_LABEL,
  disabled = false,
  radioName,
  requireHistoricalNames = false,
  showClusterCodes = true,
}: BaptismVerifierPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={mode === "select"}
            onChange={() => onModeChange("select")}
            disabled={disabled}
            className="text-primary border-gray-300 focus:ring-ring"
          />
          <span className="text-sm text-gray-700">Select person</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={mode === "historical"}
            onChange={() => onModeChange("historical")}
            disabled={disabled}
            className="text-primary border-gray-300 focus:ring-ring"
          />
          <span className="text-sm text-gray-700">
            {FORMER_NOT_IN_SYSTEM_LABEL}
          </span>
        </label>
      </div>
      {mode === "select" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
          <SearchableSelect
            value={personId}
            onChange={onPersonIdChange}
            options={options}
            placeholder="Type a name to search..."
            emptyMessage={emptyMessage}
            showEmptyOption={true}
            emptyOptionLabel={emptyOptionLabel}
            disabled={disabled}
            showStatus={false}
            showClusterCodes={showClusterCodes}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First name
              {requireHistoricalNames ? (
                <span className="text-red-500 ml-1">*</span>
              ) : null}
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last name
              {requireHistoricalNames ? (
                <span className="text-red-500 ml-1">*</span>
              ) : null}
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      )}
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
