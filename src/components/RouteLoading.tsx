import PlaneLoader from "@/components/PlaneLoader";

// Shared loading screen used by every booking-flow route
// (booking, passengers, services, payment, invoice).
// Each route's loading.tsx just re-exports this — Next.js still requires
// the file to physically exist in every segment, but the markup lives here.
export default function RouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-white via-[#FBF7EE] to-[#F3E7D0]">
      <PlaneLoader />
    </main>
  );
}
