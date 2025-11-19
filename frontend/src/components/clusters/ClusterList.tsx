import { Cluster } from "@/src/types/cluster";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { formatPersonName } from "@/src/lib/name";

interface ClusterListProps {
  clusters: Cluster[];
  onEdit: (cluster: Cluster) => void;
  onDelete: (cluster: Cluster) => void;
}

export default function ClusterList({
  clusters,
  onEdit,
  onDelete,
}: ClusterListProps) {
  if (clusters.length === 0) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">No clusters found.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clusters.map((cluster) => (
        <Card key={cluster.id}>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {cluster.name || "Unnamed Cluster"}
              </h3>
              {cluster.code && (
                <p className="text-sm text-gray-500">Code: {cluster.code}</p>
              )}
            </div>
            {cluster.coordinator && (
              <div>
                <p className="text-sm text-gray-600">
                  Coordinator: {formatPersonName(cluster.coordinator)}
                </p>
              </div>
            )}
            <div className="flex gap-2 text-sm text-gray-600">
              <span>Members: {cluster.members?.length || 0}</span>
              <span>•</span>
              <span>Families: {cluster.families?.length || 0}</span>
            </div>
            {cluster.location && (
              <p className="text-sm text-gray-600">Location: {cluster.location}</p>
            )}
            {cluster.meeting_schedule && (
              <p className="text-sm text-gray-600">
                Schedule: {cluster.meeting_schedule}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(cluster)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(cluster)}
                className="text-red-600 hover:text-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

