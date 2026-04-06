import { NotFoundState } from "@/components/feedback/page-state";

export default function ChatThreadNotFound() {
  return (
    <NotFoundState
      title="That thread is gone"
      description="The thread you tried to open does not exist for this workspace anymore."
      backHref="/app/threads"
    />
  );
}
