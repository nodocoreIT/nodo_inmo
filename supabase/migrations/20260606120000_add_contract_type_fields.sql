-- nodo_inmo.contracts — Phase C: contract-generator metadata
--
-- Adds the three fields the "Contrato de Locación" PDF needs that are not yet
-- captured by the contract row: the legal contract type (habitacional vs
-- comercial — drives which static clauses render), and the signing place/date
-- printed on the signature block.
--
-- contract_type is NOT NULL with a default so every existing row backfills to
-- 'habitacional' (the dominant case) without a separate UPDATE. signing_date /
-- signing_city are nullable — they are often unknown at draft time and the PDF
-- prints a blank line ("____") when absent.

alter table nodo_inmo.contracts
  add column signing_date date,
  add column signing_city text default 'Ciudad Autónoma de Buenos Aires',
  add column contract_type text not null default 'habitacional'
    check (contract_type in ('habitacional', 'comercial'));
