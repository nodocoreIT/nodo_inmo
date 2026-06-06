import type { DocumentType } from "@/features/documentos/hooks/use-upload-document";

const TYPE_COLORS: Record<DocumentType, string> = {
  factura:     "bg-blue-100 text-blue-800",
  presupuesto: "bg-yellow-100 text-yellow-800",
  certificado: "bg-green-100 text-green-800",
  otro:        "bg-gray-100 text-gray-800",
};

const TYPE_LABELS: Record<DocumentType, string> = {
  factura:     "Factura",
  presupuesto: "Presupuesto",
  certificado: "Certificado",
  otro:        "Otro",
};

interface DocumentTypeBadgeProps {
  type: string;
}

/**
 * Color-coded badge for document types.
 * Mirrors ContractStatusBadge pattern.
 */
export function DocumentTypeBadge({ type }: DocumentTypeBadgeProps) {
  const colorClass = TYPE_COLORS[type as DocumentType] ?? "bg-gray-100 text-gray-800";
  const label = TYPE_LABELS[type as DocumentType] ?? type;

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}
