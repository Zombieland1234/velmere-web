import { VelmereRouteLoadingMark } from "@/components/ui/VelmereRouteTransition";

type RouteLoadingShellProps = {
  label?: string;
};

export default function RouteLoadingShell({ label = "Velmère" }: RouteLoadingShellProps) {
  return (
    <main
      className="velmere-route-loading-screen"
      aria-busy="true"
      aria-live="polite"
      data-velmere-route-loading="true"
      data-pass2007-shared-route-loading="stable-solid-low-motion"
    >
      <span className="sr-only">{label}</span>
      <span className="velmere-route-loading-screen__ambient" aria-hidden="true" />
      <VelmereRouteLoadingMark label={label} />
    </main>
  );
}
