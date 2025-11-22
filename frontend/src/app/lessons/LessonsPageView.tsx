import DashboardLayout from "@/src/components/layout/DashboardLayout";
import LessonList from "@/src/components/lessons/LessonList";
import LessonDetailPanel from "@/src/components/lessons/LessonDetailPanel";
import LessonForm, {
  LessonFormValues,
} from "@/src/components/lessons/LessonForm";
import LessonStatsCards from "@/src/components/lessons/LessonStatsCards";
import LessonSessionReportForm from "@/src/components/lessons/LessonSessionReportForm";
import LessonContentTabs, {
  LessonContentTab,
} from "@/src/components/lessons/LessonContentTabs";
import MemberProgressSection from "@/src/components/lessons/MemberProgressSection";
import SessionReportsSection, {
  LessonPersonLike,
  SessionFilterValues,
} from "@/src/components/lessons/SessionReportsSection";
import CommitmentFormSection from "@/src/components/lessons/CommitmentFormSection";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Card from "@/src/components/ui/Card";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import NoteInputModal from "@/src/components/ui/NoteInputModal";
import {
  Lesson,
  LessonCommitmentSettings,
  LessonProgressStatus,
  LessonProgressSummary,
  LessonSessionReport,
  LessonSessionReportInput,
  PersonLessonProgress,
  PersonProgressSummary,
  LessonPersonSummary,
} from "@/src/types/lesson";
import PersonLessonProgressModal from "@/src/components/lessons/PersonLessonProgressModal";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";

interface LessonsPageViewProps {
  // Lessons state
  lessons: Lesson[];
  lessonsLoading: boolean;
  lessonsError: string | null;
  selectedLessonId: number | null;
  selectedLesson: Lesson | null;
  onSelectLesson: (lesson: Lesson) => void;
  // Progress state
  progress: PersonLessonProgress[];
  progressLoading: boolean;
  progressError: string | null;
  progressActionError: string | null;
  isProgressUpdating: boolean;
  progressSummary: Record<LessonProgressStatus, number>;
  // Summary state
  summary: LessonProgressSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  // Commitment state
  commitmentSettings: LessonCommitmentSettings | null;
  commitmentLoading: boolean;
  commitmentError: string | null;
  isCommitmentModalOpen: boolean;
  commitmentFile: File | null;
  commitmentUploading: boolean;
  commitmentUploadError: string | null;
  commitmentConfirm: {
    record: PersonLessonProgress;
    nextValue: boolean;
  } | null;
  // Note input modal
  noteInputModal: {
    isOpen: boolean;
    record: PersonLessonProgress | null;
  };
  // Alert modal
  alertModal: {
    isOpen: boolean;
    message: string;
    title?: string;
  };
  // Lesson form state
  isLessonFormOpen: boolean;
  lessonFormSubmitting: boolean;
  lessonFormError: string | null;
  editingLesson: Lesson | null;
  // Assign state
  assigning: boolean;
  assignError: string | null;
  peopleLoading: boolean;
  peopleError: string | null;
  // Grouped progress state
  allProgress: PersonLessonProgress[];
  allProgressLoading: boolean;
  allProgressError: string | null;
  groupedProgress: PersonProgressSummary[];
  progressFilterLessonId: number | null;
  activeLatestLessons: Lesson[];
  // Person progress modal
  personProgressModal: {
    isOpen: boolean;
    person: LessonPersonSummary | null;
  };
  // Content tab state
  activeContentTab: LessonContentTab;
  // Session reports state
  sessionReports: LessonSessionReport[];
  sessionReportsLoading: boolean;
  sessionReportsError: string | null;
  isSessionModalOpen: boolean;
  sessionFormSubmitting: boolean;
  sessionFormError: string | null;
  editingSessionReport: LessonSessionReport | null;
  sessionDeleteTarget: LessonSessionReport | null;
  sessionDeleteLoading: boolean;
  sessionDeleteError: string | null;
  sessionFormDefaults: {
    studentId?: string | number | null;
    teacherId?: string | number | null;
    lessonId?: string | number | null;
    progressId?: string | number | null;
  };
  sessionFilters: SessionFilterValues;
  sessionFilterDraft: SessionFilterValues;
  // Delete lesson state
  lessonDeleteTarget: Lesson | null;
  lessonDeleteLoading: boolean;
  lessonDeleteError: string | null;
  // People data
  people: Person[];
  teacherChoices: LessonPersonLike[];
  studentChoices: LessonPersonLike[];
  currentTeacherId: string | null;
  // Format functions
  formatDateOnly: (value?: string | null) => string;
  formatDateTime: (value?: string | null) => string;
  // Handlers
  onOpenCreateLesson: () => void;
  onOpenEditLesson: (lesson: Lesson) => void;
  onRequestDeleteLesson: (lesson: Lesson) => void;
  onConfirmDeleteLesson: () => void;
  onCloseLessonForm: () => void;
  onLessonFormSubmit: (values: LessonFormValues) => void;
  onMarkCompleted: (record: PersonLessonProgress) => void;
  onNoteInputConfirm: (note: string) => void;
  onUpdateStatus: (
    record: PersonLessonProgress,
    status: LessonProgressStatus
  ) => void;
  onRequestCommitmentToggle: (record: PersonLessonProgress) => void;
  onConfirmCommitmentToggle: () => void;
  onOpenCommitmentModal: () => void;
  onCloseCommitmentModal: () => void;
  onCommitmentUpload: () => void;
  onSetCommitmentFile: (file: File | null) => void;
  onCloseNoteInputModal: () => void;
  onCloseAlertModal: () => void;
  onSetCommitmentConfirm: (
    confirm: {
      record: PersonLessonProgress;
      nextValue: boolean;
    } | null
  ) => void;
  onAssignLessons: (personIds: string[], lessonIds: number[]) => void;
  onProgressFilterChange: (lessonId: number | null) => void;
  onOpenPersonProgressModal: (person: LessonPersonSummary) => void;
  onClosePersonProgressModal: () => void;
  onSetActiveContentTab: (tab: LessonContentTab) => void;
  onUpdateSessionFilterDraft: (
    field: keyof SessionFilterValues,
    value: string
  ) => void;
  onApplySessionFilters: () => void;
  onResetSessionFilters: () => void;
  onExportSessionReports: () => void;
  onOpenSessionReportModal: () => void;
  onOpenSessionReportForEdit: (report: LessonSessionReport) => void;
  onCloseSessionModal: () => void;
  onSessionFormSubmit: (values: LessonSessionReportInput) => void;
  onLogSessionFromProgress: (record: PersonLessonProgress) => void;
  onRequestDeleteSessionReport: (report: LessonSessionReport) => void;
  onConfirmDeleteSessionReport: () => void;
  onSetSessionDeleteTarget: (target: LessonSessionReport | null) => void;
  onSetLessonDeleteTarget: (target: Lesson | null) => void;
  onSetLessonDeleteError: (error: string | null) => void;
}

export default function LessonsPageView({
  lessons,
  lessonsLoading,
  lessonsError,
  selectedLessonId,
  selectedLesson,
  onSelectLesson,
  progress,
  progressLoading,
  progressError,
  progressActionError,
  isProgressUpdating,
  progressSummary,
  summary,
  summaryLoading,
  summaryError,
  commitmentSettings,
  commitmentLoading,
  commitmentError,
  isCommitmentModalOpen,
  commitmentFile,
  commitmentUploading,
  commitmentUploadError,
  commitmentConfirm,
  noteInputModal,
  alertModal,
  isLessonFormOpen,
  lessonFormSubmitting,
  lessonFormError,
  editingLesson,
  assigning,
  assignError,
  peopleLoading,
  peopleError,
  activeContentTab,
  sessionReports,
  sessionReportsLoading,
  sessionReportsError,
  isSessionModalOpen,
  sessionFormSubmitting,
  sessionFormError,
  editingSessionReport,
  sessionDeleteTarget,
  sessionDeleteLoading,
  sessionDeleteError,
  sessionFormDefaults,
  sessionFilters,
  sessionFilterDraft,
  lessonDeleteTarget,
  lessonDeleteLoading,
  lessonDeleteError,
  people,
  teacherChoices,
  studentChoices,
  currentTeacherId,
  formatDateOnly,
  formatDateTime,
  onOpenCreateLesson,
  onOpenEditLesson,
  onRequestDeleteLesson,
  onConfirmDeleteLesson,
  onCloseLessonForm,
  onLessonFormSubmit,
  onMarkCompleted,
  onNoteInputConfirm,
  onUpdateStatus,
  onRequestCommitmentToggle,
  onConfirmCommitmentToggle,
  onOpenCommitmentModal,
  onCloseCommitmentModal,
  onCommitmentUpload,
  onSetCommitmentFile,
  onCloseNoteInputModal,
  onCloseAlertModal,
  onSetCommitmentConfirm,
  onAssignLessons,
  onProgressFilterChange,
  onOpenPersonProgressModal,
  onClosePersonProgressModal,
  allProgress,
  allProgressLoading,
  allProgressError,
  groupedProgress,
  progressFilterLessonId,
  activeLatestLessons,
  personProgressModal,
  onSetActiveContentTab,
  onUpdateSessionFilterDraft,
  onApplySessionFilters,
  onResetSessionFilters,
  onExportSessionReports,
  onOpenSessionReportModal,
  onOpenSessionReportForEdit,
  onCloseSessionModal,
  onSessionFormSubmit,
  onLogSessionFromProgress,
  onRequestDeleteSessionReport,
  onConfirmDeleteSessionReport,
  onSetSessionDeleteTarget,
  onSetLessonDeleteTarget,
  onSetLessonDeleteError,
}: LessonsPageViewProps) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#2D3748]">
              New Converts Course
            </h1>
            <p className="text-sm text-gray-600">
              Track lesson content, version labels, and participant journeys
              across the conversion journey.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={onOpenSessionReportModal}
            disabled={!selectedLesson}
            className="self-start md:self-auto"
          >
            Log Session
          </Button>
        </div>

        {lessonsError && <ErrorMessage message={lessonsError} />}

        <LessonStatsCards
          summary={summary}
          visitorsAwaitingCount={summary?.unassigned_visitors ?? 0}
          loading={summaryLoading}
          error={summaryError}
        />

        <div className="mt-10 border-t border-gray-200 pt-7 space-y-6">
          <LessonContentTabs
            activeTab={activeContentTab}
            onTabChange={onSetActiveContentTab}
            disableSessions={!selectedLesson}
          />

          <div
            className={activeContentTab === "lesson" ? "space-y-6" : "hidden"}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                {lessonsLoading ? (
                  <Card>
                    <LoadingSpinner />
                  </Card>
                ) : (
                  <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
                    <LessonList
                      lessons={lessons}
                      selectedLessonId={selectedLessonId}
                      onSelect={onSelectLesson}
                      onEdit={onOpenEditLesson}
                      onCreateNew={onOpenCreateLesson}
                    />
                  </div>
                )}
              </div>
              <div className="lg:col-span-2">
                <LessonDetailPanel
                  lesson={selectedLesson}
                  onEdit={onOpenEditLesson}
                />
              </div>
            </div>
          </div>

          <div
            className={activeContentTab === "progress" ? "space-y-6" : "hidden"}
          >
            <MemberProgressSection
              allLessons={lessons}
              groupedProgress={groupedProgress}
              progressLoading={allProgressLoading}
              progressError={allProgressError}
              progressActionError={progressActionError}
              progressFilterLessonId={progressFilterLessonId}
              onProgressFilterChange={onProgressFilterChange}
              people={people}
              peopleLoading={peopleLoading}
              peopleError={peopleError}
              assigning={assigning}
              assignError={assignError}
              onAssignLessons={onAssignLessons}
              onPersonClick={onOpenPersonProgressModal}
            />
          </div>

          <div
            className={activeContentTab === "sessions" ? "space-y-6" : "hidden"}
          >
            <SessionReportsSection
              selectedLesson={selectedLesson}
              sessionReports={sessionReports}
              sessionReportsLoading={sessionReportsLoading}
              sessionReportsError={sessionReportsError}
              sessionFilterDraft={sessionFilterDraft}
              teacherChoices={teacherChoices}
              studentChoices={studentChoices}
              onFilterChange={onUpdateSessionFilterDraft}
              onApplyFilters={onApplySessionFilters}
              onResetFilters={onResetSessionFilters}
              onExport={onExportSessionReports}
              onOpenSessionModal={onOpenSessionReportModal}
              onEditSession={onOpenSessionReportForEdit}
              onRequestDelete={onRequestDeleteSessionReport}
              formatDateOnly={formatDateOnly}
              formatDateTime={formatDateTime}
              canLogSession={Boolean(selectedLesson)}
              canExport={sessionReports.length > 0}
            />
          </div>

          <div
            className={
              activeContentTab === "commitment" ? "space-y-6" : "hidden"
            }
          >
            <CommitmentFormSection
              commitmentSettings={commitmentSettings}
              commitmentLoading={commitmentLoading}
              commitmentError={commitmentError}
              onOpenModal={onOpenCommitmentModal}
            />
          </div>
        </div>
      </div>

      <Modal
        isOpen={isLessonFormOpen}
        onClose={onCloseLessonForm}
        title={editingLesson ? "Edit Lesson" : "New Lesson"}
      >
        {lessonFormError && (
          <div className="mb-4">
            <ErrorMessage message={lessonFormError} />
          </div>
        )}
        <LessonForm
          lesson={editingLesson}
          submitting={lessonFormSubmitting}
          deleteDisabled={lessonDeleteLoading}
          onSubmit={onLessonFormSubmit}
          onCancel={onCloseLessonForm}
          onDelete={
            editingLesson
              ? () => onRequestDeleteLesson(editingLesson)
              : undefined
          }
        />
      </Modal>

      <Modal
        isOpen={Boolean(commitmentConfirm)}
        onClose={() => onSetCommitmentConfirm(null)}
        title={
          commitmentConfirm?.nextValue
            ? "Confirm Commitment Signature"
            : "Remove Commitment Signature"
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {commitmentConfirm?.nextValue
              ? `Mark ${formatPersonName(
                  commitmentConfirm.record.person
                )} as having signed the commitment form? This will add a journey to the conversion timeline.`
              : commitmentConfirm
              ? `Remove the commitment signature for ${formatPersonName(
                  commitmentConfirm.record.person
                )}? This will clear the journey entry.`
              : ""}
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="tertiary"
            onClick={() => onSetCommitmentConfirm(null)}
            disabled={isProgressUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirmCommitmentToggle}
            disabled={isProgressUpdating}
          >
            {isProgressUpdating ? "Updating..." : "Confirm"}
          </Button>
        </div>
      </Modal>

      <NoteInputModal
        isOpen={noteInputModal.isOpen}
        onClose={onCloseNoteInputModal}
        onConfirm={onNoteInputConfirm}
        title="Add Note for Journey"
        message="Add a note for this journey (optional):"
        initialValue={noteInputModal.record?.notes ?? ""}
        loading={isProgressUpdating}
      />

      <ConfirmationModal
        isOpen={alertModal.isOpen}
        onClose={onCloseAlertModal}
        onConfirm={onCloseAlertModal}
        title={alertModal.title || "Information"}
        message={alertModal.message}
        confirmText="OK"
        variant="info"
      />

      <Modal
        isOpen={isCommitmentModalOpen}
        onClose={onCloseCommitmentModal}
        title="Upload Commitment Form"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a PDF version of the commitment form that students will sign
            after completing the course.
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) =>
              onSetCommitmentFile(event.target.files?.[0] ?? null)
            }
            className="block w-full text-sm text-gray-700"
          />
          {commitmentUploadError && (
            <ErrorMessage message={commitmentUploadError} />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onClick={onCloseCommitmentModal}>
              Cancel
            </Button>
            <Button
              onClick={onCommitmentUpload}
              disabled={commitmentUploading || !commitmentFile}
            >
              {commitmentUploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(lessonDeleteTarget)}
        onClose={() => {
          if (lessonDeleteLoading) return;
          onSetLessonDeleteTarget(null);
          onSetLessonDeleteError(null);
        }}
        onConfirm={onConfirmDeleteLesson}
        title="Delete Lesson"
        message={
          lessonDeleteError
            ? `${lessonDeleteError} Please try again.`
            : `Are you sure you want to delete the "${lessonDeleteTarget?.title}" lesson? This action cannot be undone and will remove it from the catalog for all users.`
        }
        confirmText="Delete Lesson"
        cancelText="Cancel"
        variant="danger"
        loading={lessonDeleteLoading}
      />

      <Modal
        isOpen={isSessionModalOpen}
        onClose={onCloseSessionModal}
        title={
          editingSessionReport ? "Edit Lesson Session" : "Log Lesson Session"
        }
      >
        <LessonSessionReportForm
          report={editingSessionReport}
          submitting={sessionFormSubmitting}
          onSubmit={onSessionFormSubmit}
          onCancel={onCloseSessionModal}
          people={people}
          lessons={lessons}
          defaultLessonId={
            sessionFormDefaults.lessonId ?? selectedLessonId ?? undefined
          }
          defaultTeacherId={
            sessionFormDefaults.teacherId ?? currentTeacherId ?? undefined
          }
          defaultStudentId={sessionFormDefaults.studentId ?? undefined}
          error={sessionFormError}
        />
      </Modal>

      <Modal
        isOpen={Boolean(sessionDeleteTarget)}
        onClose={() => onSetSessionDeleteTarget(null)}
        title="Delete Session Report"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete the session report for{" "}
            <span className="font-semibold text-gray-800">
              {formatPersonName(sessionDeleteTarget?.student)}
            </span>{" "}
            recorded on {formatDateTime(sessionDeleteTarget?.session_start)}?
            This action cannot be undone.
          </p>
          {sessionDeleteError && <ErrorMessage message={sessionDeleteError} />}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="tertiary"
            onClick={() => onSetSessionDeleteTarget(null)}
            disabled={sessionDeleteLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirmDeleteSessionReport}
            disabled={sessionDeleteLoading}
          >
            {sessionDeleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>

      <PersonLessonProgressModal
        isOpen={personProgressModal.isOpen}
        person={personProgressModal.person}
        allProgress={allProgress}
        allLessons={lessons}
        onClose={onClosePersonProgressModal}
      />
    </DashboardLayout>
  );
}
