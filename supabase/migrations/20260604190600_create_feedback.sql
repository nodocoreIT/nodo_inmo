-- Create shared.feedback table to persist application feedback
create table shared.feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references shared.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('bug', 'idea', 'bloat')),
  content text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table shared.feedback enable row level security;

-- Policies
create policy "Users can insert feedback"
  on shared.feedback
  for insert
  to authenticated
  with check (true);

create policy "Admins can select feedback"
  on shared.feedback
  for select
  to authenticated
  using (
    exists (
      select 1 from shared.org_members
      where org_members.user_id = auth.uid()
        and org_members.role = 'admin'
    )
  );
