import { notFound } from "next/navigation";
import C14P27ErrorProbe from "./ErrorProbe";

export const dynamic = "force-dynamic";

export default function C14P27ErrorFixture() {
  if (process.env.VELMERE_VISUAL_REGRESSION_FIXTURES !== "1") {
    notFound();
  }

  return <C14P27ErrorProbe />;
}
