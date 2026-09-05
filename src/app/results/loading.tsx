import PlaneLoader from "@/components/PlaneLoader";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#FBF7EE] to-[#F3E7D0]">
      <PlaneLoader label="Searching flights..." />
    </main>
  );
}
