// Goes in: D:\AreBook\src\app\loading.tsx

import PlaneLoader from "@/components/PlaneLoader";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#F5FAFF] to-white">
      <PlaneLoader label="Getting things ready..." />
    </div>
  );
}