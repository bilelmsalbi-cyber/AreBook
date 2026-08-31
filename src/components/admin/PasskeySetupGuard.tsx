"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function PasskeySetupGuard({ mustSetup }: { mustSetup: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (mustSetup && pathname !== "/admin/security") {
      router.replace("/admin/security?required=1");
    }
  }, [mustSetup, pathname, router]);

  return null;
}