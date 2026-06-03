import { useContacts } from "@/features/contacts/hooks/use-contacts";
import { ContactsListTable } from "./contacts-list-table";

export function InquilinosList() {
  const { data, isLoading, isError } = useContacts("tenant");

  return (
    <ContactsListTable
      heading="Inquilinos"
      subheading="Listado de inquilinos de la agencia"
      createLabel="Nuevo inquilino"
      emptyMessage="Todavía no cargaste inquilinos"
      defaultRole="tenant"
      columnConfig={{ showCommission: false }}
      data={data}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
