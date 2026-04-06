import { LoadingState } from "@/components/feedback/page-state";

export default function ProvidersLoading() {
  return (
    <LoadingState
      title="Loading provider lanes"
      description="Checking saved connections, health status, and cached models."
    />
  );
}
