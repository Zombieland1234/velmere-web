import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function C14P27ErrorFixture() {
  if (process.env.VELMERE_VISUAL_REGRESSION_FIXTURES !== "1") {
    notFound();
  }

  throw new Error("c14-p27-visual-error-fixture");
}
