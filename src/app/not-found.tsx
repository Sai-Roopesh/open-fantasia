import { NotFoundState } from "@/components/feedback/page-state";

export default function RootNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <NotFoundState
        title="Fantasia could not find that page"
        description="The route you requested doesn’t exist in this workspace."
        backHref="/"
      />
    </div>
  );
}
