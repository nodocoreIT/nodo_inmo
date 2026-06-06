import {
  Waves,
  PawPrint,
  Car,
  TreePine,
  WashingMachine,
  Flame,
  MoveVertical,
  ParkingCircle,
} from "lucide-react";
import type { PortalProperty } from "../hooks/use-portal-properties";

interface AmenityDef {
  key: keyof PortalProperty;
  icon: React.ReactNode;
  label: string;
}

const AMENITIES: AmenityDef[] = [
  { key: "has_pool", icon: <Waves className="h-3.5 w-3.5" />, label: "Pileta" },
  { key: "pets_allowed", icon: <PawPrint className="h-3.5 w-3.5" />, label: "Mascotas" },
  { key: "has_garage", icon: <Car className="h-3.5 w-3.5" />, label: "Garaje" },
  { key: "has_garden", icon: <TreePine className="h-3.5 w-3.5" />, label: "Jardín" },
  { key: "has_laundry", icon: <WashingMachine className="h-3.5 w-3.5" />, label: "Lavadero" },
  { key: "has_bbq", icon: <Flame className="h-3.5 w-3.5" />, label: "Parrilla" },
  { key: "has_elevator", icon: <MoveVertical className="h-3.5 w-3.5" />, label: "Ascensor" },
  { key: "has_parking", icon: <ParkingCircle className="h-3.5 w-3.5" />, label: "Estacionamiento" },
];

export function PropertyAmenityIcons({
  property,
  max = 4,
}: {
  property: PortalProperty;
  max?: number;
}) {
  const active = AMENITIES.filter((a) => !!property[a.key]);
  if (active.length === 0) return null;

  const shown = active.slice(0, max);
  const extra = active.length - max;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((a) => (
        <span
          key={a.key as string}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
          title={a.label}
        >
          {a.icon}
          {a.label}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[11px] text-slate-500">+{extra} más</span>
      )}
    </div>
  );
}

export function PropertyAmenityIconsLarge({ property }: { property: PortalProperty }) {
  const active = AMENITIES.filter((a) => !!property[a.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((a) => (
        <span
          key={a.key as string}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-slate2"
        >
          {a.icon}
          {a.label}
        </span>
      ))}
    </div>
  );
}
