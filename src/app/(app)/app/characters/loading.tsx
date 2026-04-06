import { LoadingState } from "@/components/feedback/page-state";

export default function CharactersLoading() {
  return (
    <LoadingState
      title="Loading character studio"
      description="Preparing the builder and your saved character sheets."
    />
  );
}
