-- R6: Enable row-level security on every shared table.
alter table shared.organizations  enable row level security;
alter table shared.org_members    enable row level security;
alter table shared.user_profiles  enable row level security;
alter table shared.indices        enable row level security;
alter table shared.nodo_id        enable row level security;
