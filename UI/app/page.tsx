import { Suspense } from "react";
import MapPage from "@/components/MapPage";

// NAV-2: the site opens straight on the Map tab. No login.
export default function Home() {
  return (
    <Suspense>
      <MapPage />
    </Suspense>
  );
}
