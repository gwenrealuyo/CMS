import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { LessonCommitmentSettings } from "@/src/types/lesson";

interface CommitmentFormSectionProps {
  commitmentSettings: LessonCommitmentSettings | null;
  commitmentLoading: boolean;
  commitmentError: string | null;
  onOpenModal: () => void;
}

export default function CommitmentFormSection({
  commitmentSettings,
  commitmentLoading,
  commitmentError,
  onOpenModal,
}: CommitmentFormSectionProps) {
  const commitmentUrl = commitmentSettings?.commitment_form_url ?? "";
  const hasCommitmentForm = Boolean(commitmentUrl && !commitmentLoading);

  return (
    <Card title="Commitment Forms">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Share and update the latest commitment PDF for teachers to download
          and mark participants as signed.
        </p>

        {commitmentError && <ErrorMessage message={commitmentError} />}

        {commitmentLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {hasCommitmentForm ? (
              <a href={commitmentUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" className="sm:w-auto text-sm">
                  Download Current PDF
                </Button>
              </a>
            ) : (
              <span className="text-sm text-gray-500">
                No commitment form uploaded yet.
              </span>
            )}
            <Button onClick={onOpenModal} className="sm:w-auto text-sm">
              {hasCommitmentForm
                ? "Replace Commitment Form"
                : "Upload Commitment Form"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}


