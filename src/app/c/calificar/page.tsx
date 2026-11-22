import type { Metadata } from "next";

import { RatingScreen } from "@/components/company/rating-screen";

export const metadata: Metadata = { title: "Calificar" };

export default function CompanyRatingPage() {
  return <RatingScreen />;
}
