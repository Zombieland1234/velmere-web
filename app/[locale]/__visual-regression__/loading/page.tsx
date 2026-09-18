export const dynamic = "force-dynamic";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function C14P27LoadingFixture() {
  if (process.env.VELMERE_VISUAL_REGRESSION_FIXTURES !== "1") {
    const { notFound } = await import("next/navigation");
    notFound();
  }

  await delay(3500);

  return (
    <main
      data-c14-p27-loaded="true"
      className="min-h-[100dvh] bg-velmere-black px-6 py-32 text-velmere-ivory"
    >
      <div className="mx-auto max-w-xl">
        <p className="velmere-label text-velmere-gold">C14-P27 visual fixture</p>
        <h1 className="mt-5 font-serif text-4xl">Loading boundary resolved.</h1>
      </div>
    </main>
  );
}
