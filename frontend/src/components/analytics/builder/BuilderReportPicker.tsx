"use client";

import Card from "@/src/components/ui/Card";
import {
  BUILDER_CATALOG,
  type BuilderReportId,
} from "./builderCatalog";

interface BuilderReportPickerProps {
  selectedId: BuilderReportId | null;
  onSelect: (id: BuilderReportId) => void;
}

export default function BuilderReportPicker({
  selectedId,
  onSelect,
}: BuilderReportPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {BUILDER_CATALOG.map((entry) => {
        const isSelected = selectedId === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className={`rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              isSelected ? "ring-2 ring-primary ring-offset-2" : ""
            }`}
          >
            <Card
              className={`h-full cursor-pointer ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
            >
              <p className="font-medium text-foreground">{entry.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.description}
              </p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
