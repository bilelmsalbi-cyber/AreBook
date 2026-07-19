// Goes in: D:\AreBook\src\app\results\loading.tsx

import PlaneLoader from "@/components/PlaneLoader";

export default function ResultsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#F5FAFF] to-white">
      <PlaneLoader label="Searching flights..." />
    </div>
  );
}