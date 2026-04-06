import { LoadingState } from "@/components/feedback/page-state";

export default function ThreadsLoading() {
  return (
    <LoadingState
      title="Loading thread library"
      description="Sorting active branches, recent activity, and thread controls."
    />
  );
}
