import { Home } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { PortalProperty } from "../hooks/use-portal-properties";
import { PropertyAmenityIcons } from "./amenity-icons";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatPortalPrice,
} from "../lib/portal-filters";
import { usePropertyPhotoUrl } from "@/features/properties/hooks/use-property-photo-url";

interface PropertyCardProps {
  property: PortalProperty;
  onSelect: (p: PortalProperty) => void;
}

function PropertyCardInner({
  property,
  photoUrl,
  onSelect,
}: PropertyCardProps & { photoUrl: string | null }) {
  const statusColor = STATUS_COLORS[property.status] ?? "bg-slate-100 text-slate-700";
  const statusLabel = STATUS_LABELS[property.status] ?? property.status;
  const operationLabel = OPERATION_LABELS[property.operation] ?? property.operation;
  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={property.address}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Home className="h-12 w-12 text-slate-300" />
          </div>
        )}
        {/* Gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Status badge — top left */}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor}`}>
          {statusLabel}
        </span>

        {/* Operation badge — top right */}
        <span className="absolute right-2 top-2 rounded-full bg-navy/90 px-2 py-0.5 text-[11px] font-semibold text-white">
          {operationLabel}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="text-xs text-slate2">{typeLabel}</p>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug">
            {property.address}
          </h3>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-slate2">
          {property.rooms ? (
            <span>{property.rooms} amb.</span>
          ) : null}
          {property.bathrooms ? (
            <span>{property.bathrooms} baños</span>
          ) : null}
          {property.total_sqm ? (
            <span>{property.total_sqm} m²</span>
          ) : null}
        </div>

        {/* Amenities */}
        <PropertyAmenityIcons property={property} max={3} />

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold text-brand">
            {formatPortalPrice(property.sale_price, property.currency)}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelect(property)}
            className="text-xs"
          >
            Más Info
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PropertyCard({ property, onSelect }: PropertyCardProps) {
  const { data: photoUrl } = usePropertyPhotoUrl(property.main_photo);
  return (
    <PropertyCardInner
      property={property}
      photoUrl={photoUrl ?? null}
      onSelect={onSelect}
    />
  );
}
