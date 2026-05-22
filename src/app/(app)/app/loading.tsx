import { LoadingState } from "@/components/feedback/page-state";

export default function WorkspaceLoading() {
  return (
    <LoadingState
      title="Loading workspace"
      description="Pulling your personas, providers, characters, and threads into place."
    />
  );
}
