/**
 * DocumentosPage — Contract browser + document storage for /admin/documentos.
 *
 * Phase B: read-only browse surface over existing contracts.
 * Phase D: DocumentsSection added below the contracts table.
 */
import { useState, useMemo, useEffect } from "react";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { ContractPdfActions } from "@/features/contracts/components/contract-pdf-actions";
import { ContractStatusBadge } from "@/features/contracts/components/contract-status-badge";
import { ContractLocacionButton } from "@/features/contracts/components/contract-locacion-button";
import { DocumentsSection } from "@/features/documentos/components/documents-section";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import { PAGE_SIZE } from "@/shared/lib/constants";

export function DocumentosPage() {
  const { data, isLoading, isError } = useContracts();
  const query = useSearchStore((s) => s.query);
  const [page, setPage] = useState(0);

  const filtered = (data ?? []).filter((c) =>
    matchesQuery(
      [c.tenant?.name, c.property?.address, c.status],
      query,
    ),
  );
  const noResults = !!data && data.length > 0 && filtered.length === 0;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => { setPage(0); }, [query]);

  return (
    <div className="flex flex-col gap-6">
      {isLoading && (
        <div
          role="status"
          aria-label="Cargando documentos"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar los documentos. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            No hay documentos disponibles
          </p>
          <p className="text-xs text-slate2-300">
            Los contratos activos aparecerán aquí con sus PDF disponibles.
          </p>
        </div>
      )}

      {!isLoading && !isError && noResults && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-mist py-12 text-center">
          <p className="text-sm font-medium text-slate2">
            Sin resultados para "{query}"
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Alquiler</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.tenant?.name ?? "—"}
                  </TableCell>
                  <TableCell>{contract.property?.address ?? "—"}</TableCell>
                  <TableCell>
                    <ContractStatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell>
                    {formatMoney(contract.rent_amount, contract.currency)}
                  </TableCell>
                  <TableCell>{formatDate(contract.start_date)}</TableCell>
                  <TableCell>{formatDate(contract.end_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ContractLocacionButton contract={contract} />
                      <ContractPdfActions contract={contract} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel="contratos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <div className="border-t border-border pt-6">
        <DocumentsSection />
      </div>
    </div>
  );
}
