export const dynamic = "force-dynamic";

export default function C14P27ErrorFixture() {
  if (process.env.VELMERE_VISUAL_REGRESSION_FIXTURES !== "1") {
    return null;
  }

  throw new Error("c14-p27-visual-error-fixture");
}
