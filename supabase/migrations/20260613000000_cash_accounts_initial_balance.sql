-- Saldo inicial opcional por cuenta bancaria
alter table nodo_inmo.cash_accounts
  add column if not exists initial_balance numeric(15,2) not null default 0
    check (initial_balance >= 0);
