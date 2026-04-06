import { LoadingState } from "@/components/feedback/page-state";

export default function PersonasLoading() {
  return (
    <LoadingState
      title="Loading persona library"
      description="Gathering your reusable self-profiles and thread usage."
    />
  );
}
