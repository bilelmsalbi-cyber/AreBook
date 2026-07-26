import PlaneLoader from "@/components/PlaneLoader";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#F3F9FF] to-[#E1F0FF]">
      <PlaneLoader />
    </main>
  );
}