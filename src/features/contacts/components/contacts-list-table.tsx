/**
 * Reusable contacts table + action buttons.
 * PropietariosList and InquilinosList both render this,
 * passing different column configs.
 */
import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { PaginationControls } from "@/shared/components/ui/pagination";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { ContactFormDialog } from "./contact-form-dialog";
import { useSearchStore } from "@/shared/search/use-search-store";
import { matchesQuery } from "@/shared/search/matches-query";
import type { ContactRow, ContactRole } from "@/features/contacts/hooks/use-contacts";
import { useCreateContact } from "@/features/contacts/hooks/use-create-contact";
import { useUpdateContact } from "@/features/contacts/hooks/use-update-contact";
import { useDeleteContact } from "@/features/contacts/hooks/use-delete-contact";
import { PAGE_SIZE } from "@/shared/lib/constants";

// ── Column config ─────────────────────────────────────────────────────────────

export interface ContactColumnConfig {
  /** Show Comisión column */
  showCommission: boolean;
}

// ── List props ────────────────────────────────────────────────────────────────

export interface ContactsListTableProps {
  /** Page heading */
  heading: string;
  /** Sub-heading description */
  subheading: string;
  /** Button label for creating a new contact */
  createLabel: string;
  /** Empty state message */
  emptyMessage: string;
  /** Role assigned to newly created contacts */
  defaultRole: ContactRole;
  columnConfig: ContactColumnConfig;
  data: ContactRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactsListTable({
  heading,
  createLabel,
  emptyMessage,
  defaultRole,
  columnConfig,
  data,
  isLoading,
  isError,
}: ContactsListTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactRow | null>(null);
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const query = useSearchStore((s) => s.query);
  const filtered = (data ?? []).filter((c) =>
    matchesQuery([c.name, c.dni, c.phone, c.email], query),
  );
  const noResults = !!data && data.length > 0 && filtered.length === 0;

  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    if (sortDirection === "asc") {
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    } else if (sortDirection === "desc") {
      list.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
    }
    return list;
  }, [filtered, sortDirection]);

  const totalPages = Math.ceil(sortedAndFiltered.length / PAGE_SIZE);
  const pagedRows = useMemo(
    () => sortedAndFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedAndFiltered, page],
  );

  useEffect(() => { setPage(0); }, [query]);

  return (
    <div className="flex flex-col gap-6">
      {/* Action row */}
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {createLabel}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          role="status"
          aria-label={`Cargando ${heading.toLowerCase()}`}
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">{emptyMessage}</p>
          <p className="text-xs text-slate2-300">
            Hacé clic en "{createLabel}" para empezar.
          </p>
        </div>
      )}

      {/* No search results */}
      {!isLoading && !isError && noResults && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-mist py-12 text-center">
          <p className="text-sm font-medium text-slate2">
            Sin resultados para "{query}"
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && sortedAndFiltered.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortDirection((prev) => {
                      if (prev === null) return "asc";
                      if (prev === "asc") return "desc";
                      return null;
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Nombre
                    {sortDirection === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortDirection === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                {columnConfig.showCommission && (
                  <TableHead>Comisión</TableHead>
                )}
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.dni ?? "—"}</TableCell>
                  <TableCell>{contact.phone ?? "—"}</TableCell>
                  <TableCell>{contact.email ?? "—"}</TableCell>
                  {columnConfig.showCommission && (
                    <TableCell>{contact.commission_rate}%</TableCell>
                  )}
                  <TableCell className="text-right">
                    <RowActions
                      contact={contact}
                      onEdit={() => setEditContact(contact)}
                      onDeleteConfirm={() => deleteContact.mutateAsync(contact.id)}
                    />
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
        itemLabel="contactos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {/* Create dialog */}
      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultRole={defaultRole}
        onSuccess={() => setCreateOpen(false)}
        onSubmit={(payload) => createContact.mutateAsync(payload).then(() => undefined)}
        isPending={createContact.isPending}
      />

      {/* Edit dialog */}
      {editContact && (
        <ContactFormDialog
          open={!!editContact}
          onOpenChange={(open) => {
            if (!open) setEditContact(null);
          }}
          contact={editContact}
          onSuccess={() => setEditContact(null)}
          onSubmit={(payload, c) =>
            updateContact
              .mutateAsync({ id: c!.id, ...payload })
              .then(() => undefined)
          }
          isPending={updateContact.isPending}
        />
      )}
    </div>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────

interface RowActionsProps {
  contact: ContactRow;
  onEdit: () => void;
  onDeleteConfirm: () => void;
}

function RowActions({ onEdit, onDeleteConfirm }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Editar"
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Editar</span>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Eliminar">
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">Eliminar</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
