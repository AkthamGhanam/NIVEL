import type { Metadata } from "next";

import { ReviewScreen } from "@/components/admin/review-screen";

export const metadata: Metadata = { title: "Revisión de reportes" };

export default function AdminReviewPage() {
  return <ReviewScreen />;
}
