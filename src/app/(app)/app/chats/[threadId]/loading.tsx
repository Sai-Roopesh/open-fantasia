import { LoadingState } from "@/components/feedback/page-state";

export default function ChatThreadLoading() {
  return (
    <LoadingState
      title="Loading thread"
      description="Reconstructing the active branch, transcript, and continuity state."
    />
  );
}
