import { BookOpenIcon } from "@heroicons/react/24/outline";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";

export default function ClusterBibleStudyChip() {
  return (
    <span
      className={`${STATUS_CHIP_CLASSNAME} shrink-0 px-1.5`}
      style={getStatusChipStyle("clusterBs")}
      title="Cluster Bible Study"
      aria-label="Cluster Bible Study"
    >
      <BookOpenIcon className="h-3 w-3" />
    </span>
  );
}
