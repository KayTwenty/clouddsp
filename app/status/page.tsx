import type { Metadata } from "next";
import StatusBoard from "../ui/status-board";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Live status of the cloudDSP GPU cluster: GPUs online, queue length, processing times and the last 24 hours of stem separation.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">System status</h1>
      <p className="mt-2 max-w-xl text-muted">
        Live view of the GPUs that separate your stems and the queue of tracks waiting for them.
      </p>
      <div className="mt-8">
        <StatusBoard />
      </div>
    </main>
  );
}
