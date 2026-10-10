"use client";

/**
 * Theme-reactive ambient wash for the Command Center.
 *
 * All colors resolve from theme tokens at paint time, so the wash follows
 * the active pack with no JS sync: Signal's vivid primary reads as a warm
 * glow, the monochrome packs as a neutral light/dark-toned wash.
 * Purely decorative: never intercepts pointer events, hidden from AT,
 * continuous motion gated behind `motion-safe`.
 */
export function ThemeAmbient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute -top-32 right-[-10%] h-[420px] w-[560px] rounded-full bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] blur-3xl motion-safe:animate-[cc-ambient-drift_18s_ease-in-out_infinite_alternate]" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[380px] w-[520px] rounded-full bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] blur-3xl motion-safe:animate-[cc-ambient-drift_22s_ease-in-out_infinite_alternate-reverse]" />
      <style>{`@keyframes cc-ambient-drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(-4%,5%,0) scale(1.08)}}@keyframes cc-orb-breathe{from{opacity:.55;transform:scale(1)}to{opacity:.9;transform:scale(1.06)}}`}</style>
    </div>
  );
}
