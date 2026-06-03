import { useContacts } from "@/features/contacts/hooks/use-contacts";
import { ContactsListTable } from "./contacts-list-table";

export function PropietariosList() {
  const { data, isLoading, isError } = useContacts("owner");

  return (
    <ContactsListTable
      heading="Propietarios"
      subheading="Listado de propietarios de la agencia"
      createLabel="Nuevo propietario"
      emptyMessage="Todavía no cargaste propietarios"
      defaultRole="owner"
      columnConfig={{ showCommission: true }}
      data={data}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
