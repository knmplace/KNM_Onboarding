import { Suspense } from "react";
import { GuidePreviewContent } from "./guide-preview-content";

export const metadata = {
  title: "Onboarding Guide",
};

export default function GuidePreviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: "sans-serif" }}>Loading guide…</div>}>
      <GuidePreviewContent />
    </Suspense>
  );
}
