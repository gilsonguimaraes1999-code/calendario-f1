import { StarfieldBackground } from "@/components/brand/starfield-background";

export function AppBackground({ variant }: { variant: "stars" | "vector" }) {
  if (variant === "stars") return <StarfieldBackground />;
  return <div aria-hidden="true" className="app-background app-background--vector" style={{ backgroundImage: "url('/fundo-site-vetorial.svg')" }} />;
}
