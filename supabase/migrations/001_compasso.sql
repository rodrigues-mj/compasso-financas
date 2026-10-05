-- Compasso v1. PostgreSQL/Supabase. Execute once in the SQL Editor.
-- Financial snapshots are versioned JSONB documents. CAS + a row lock serialize writes.
-- Memberships remain relational; all financial references are validated inside the RPC.
begin;
create schema if not exists compasso_private;
revoke all on schema compasso_private from public;

create table public.finance_spaces (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create table public.finance_members (
 space_id uuid not null references public.finance_spaces(id), user_id uuid not null references auth.users(id),
 name text not null, email text not null, role text not null check(role in ('admin','editor','reader')),
 active boolean not null default true, primary key(space_id,user_id)
);
create table public.finance_documents (
 space_id uuid primary key references public.finance_spaces(id), revision bigint not null default 0,
 data jsonb not null, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table public.finance_invites (
 id uuid primary key default gen_random_uuid(), space_id uuid not null references public.finance_spaces(id),
 email text not null, role text not null check(role in ('admin','editor','reader')),
 token uuid not null unique default gen_random_uuid(), expires_at timestamptz not null default(now()+interval '7 days'),
 accepted boolean not null default false, created_by uuid not null references auth.users(id)
);
create table public.finance_history (
 id bigint generated always as identity primary key, space_id uuid not null references public.finance_spaces(id),
 revision bigint not null, data jsonb not null, changed_at timestamptz not null default now(), changed_by uuid references auth.users(id),
 unique(space_id,revision)
);
create index finance_members_user_idx on public.finance_members(user_id) where active;
create index finance_history_space_idx on public.finance_history(space_id,changed_at);

create function compasso_private.role_for(p_space uuid) returns text
language sql stable security definer set search_path='' as $$
 select role from public.finance_members where space_id=p_space and user_id=auth.uid() and active;
$$;
create function public.finance_can_read(p_space uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select compasso_private.role_for(p_space) is not null;
$$;
create function public.finance_is_admin(p_space uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(compasso_private.role_for(p_space)='admin',false);
$$;
alter table public.finance_spaces enable row level security;
alter table public.finance_members enable row level security;
alter table public.finance_documents enable row level security;
alter table public.finance_invites enable row level security;
alter table public.finance_history enable row level security;
create policy read_space on public.finance_spaces for select to authenticated using(public.finance_can_read(id));
create policy read_members on public.finance_members for select to authenticated using(public.finance_can_read(space_id));
create policy read_document on public.finance_documents for select to authenticated using(public.finance_can_read(space_id));
create policy read_invites on public.finance_invites for select to authenticated using(public.finance_is_admin(space_id));
create policy read_history on public.finance_history for select to authenticated using(public.finance_is_admin(space_id));
revoke all on public.finance_spaces,public.finance_members,public.finance_documents,public.finance_invites,public.finance_history from anon,authenticated;
grant select on public.finance_spaces,public.finance_members,public.finance_documents,public.finance_invites,public.finance_history to authenticated;

create function compasso_private.items(d jsonb,k text) returns setof jsonb language sql immutable as $$ select value from jsonb_array_elements(d->k); $$;
create function compasso_private.has(d jsonb,k text,v text) returns boolean language sql immutable as $$
 select v is null or exists(select 1 from jsonb_array_elements(d->k) x where x->>'id'=v);
$$;
create function compasso_private.amount(v jsonb) returns bigint language plpgsql immutable as $$
declare n numeric;
begin
 if jsonb_typeof(v) is distinct from 'number' then raise exception 'Valor monetário inválido'; end if;
 n := v::text::numeric;
 if n<1 or n>100000000000 or n<>trunc(n) then raise exception 'Use valores positivos em centavos, até R$ 1 bilhão'; end if;
 return n::bigint;
end $$;
create function compasso_private.valid_date(v text) returns boolean language plpgsql immutable as $$
begin
 if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
 return to_char(v::date,'YYYY-MM-DD')=v;
exception when others then return false;
end $$;
create function compasso_private.debt(d jsonb,eid text,cid text) returns bigint language sql immutable as $$
 select coalesce((select sum((a->>'amount')::bigint) from compasso_private.items(d,'entries') e cross join lateral jsonb_array_elements(e->'allocations') a where e->>'id'=eid and e->>'status'<>'cancelled' and a->>'contactId'=cid),0)
 - coalesce((select sum((a->>'amount')::bigint) from compasso_private.items(d,'entries') e cross join lateral jsonb_array_elements(e->'allocations') a where e->>'originalId'=eid and e->>'status'<>'cancelled' and a->>'contactId'=cid),0);
$$;
create function compasso_private.received(d jsonb,eid text,cid text) returns bigint language sql immutable as $$
 select coalesce((select sum((a->>'amount')::bigint) from compasso_private.items(d,'receipts') r cross join lateral jsonb_array_elements(r->'allocations') a where a->>'entryId'=eid and a->>'contactId'=cid),0)
 - coalesce((select sum((r->>'amount')::bigint) from compasso_private.items(d,'returns') r where r->>'entryId'=eid and r->>'contactId'=cid),0);
$$;
create function compasso_private.available(d jsonb,rid text,eid text,cid text) returns bigint language sql immutable as $$
 select coalesce((select sum((a->>'amount')::bigint) from compasso_private.items(d,'receipts') r cross join lateral jsonb_array_elements(r->'allocations') a where r->>'id'=rid and a->>'entryId'=eid and a->>'contactId'=cid),0)
 - coalesce((select sum((a->>'amount')::bigint) from compasso_private.items(d,'payments') p cross join lateral jsonb_array_elements(p->'uses') a where a->>'receiptId'=rid and a->>'entryId'=eid and a->>'contactId'=cid),0)
 - coalesce((select sum((r->>'amount')::bigint) from compasso_private.items(d,'returns') r where r->>'receiptId'=rid and r->>'entryId'=eid and r->>'contactId'=cid),0);
$$;
create function compasso_private.invoice_remaining(d jsonb,cid text,m text) returns bigint language plpgsql immutable as $$
declare x record; credit bigint:=0; total bigint; paid bigint;
begin
 for x in select distinct e->>'month' as month from compasso_private.items(d,'entries') e where e->>'cardId'=cid and e->>'month'<m and e->>'status'<>'cancelled' order by month loop
  select coalesce(sum((e->>'amount')::bigint*case when e->>'kind'='refund' then -1 else 1 end),0) into total from compasso_private.items(d,'entries') e where e->>'cardId'=cid and e->>'month'=x.month and e->>'status'<>'cancelled';
  select coalesce(sum((p->>'amount')::bigint),0) into paid from compasso_private.items(d,'payments') p where p->>'cardId'=cid and p->>'month'=x.month;
  credit:=greatest(0,credit+paid-total);
 end loop;
 select coalesce(sum((e->>'amount')::bigint*case when e->>'kind'='refund' then -1 else 1 end),0) into total from compasso_private.items(d,'entries') e where e->>'cardId'=cid and e->>'month'=m and e->>'status'<>'cancelled';
 select coalesce(sum((p->>'amount')::bigint),0) into paid from compasso_private.items(d,'payments') p where p->>'cardId'=cid and p->>'month'=m;
 return greatest(0,total-credit-paid);
end $$;

create function compasso_private.validate_document(d jsonb,p_space uuid) returns void language plpgsql set search_path='' as $$
#variable_conflict use_column
declare k text; e jsonb; a jsonb; r jsonb; p jsonb; u jsonb; original jsonb; cat jsonb; total bigint; amount bigint; received bigint;
begin
 if jsonb_typeof(d) is distinct from 'object' or d->>'version' is distinct from '1' or octet_length(d::text)>10000000 then raise exception 'Backup ou documento inválido'; end if;
 foreach k in array array['banks','categories','cards','contacts','entries','receipts','payments','returns','series','budgets'] loop
  if jsonb_typeof(d->k) is distinct from 'array' then raise exception 'Coleção inválida: %',k; end if;
  if exists(select 1 from compasso_private.items(d,k) x where jsonb_typeof(x) is distinct from 'object' or x->>'id' is null or x->>'id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then raise exception 'Identificador inválido'; end if;
  if (select count(*) from compasso_private.items(d,k))<>(select count(distinct x->>'id') from compasso_private.items(d,k) x) then raise exception 'Identificador duplicado'; end if;
 end loop;
 foreach k in array array['banks','categories','cards','contacts'] loop
  for e in select * from compasso_private.items(d,k) loop
   if length(trim(coalesce(e->>'name',''))) not between 1 and 120 or e->>'color' !~ '^#[0-9a-fA-F]{6}$' or jsonb_typeof(e->'archived') is distinct from 'boolean' then raise exception 'Cadastro inválido'; end if;
  end loop;
 end loop;
 for e in select * from compasso_private.items(d,'categories') loop
  if coalesce(e->>'kind','') not in ('income','expense') or not compasso_private.has(d,'categories',e->>'parentId') or e->>'parentId'=e->>'id' then raise exception 'Categoria inválida'; end if;
  if e ? 'parentId' and exists(select 1 from compasso_private.items(d,'categories') c where c->>'id'=e->>'parentId' and (c ? 'parentId' or c->>'kind'<>e->>'kind')) then raise exception 'Subcategoria inválida'; end if;
 end loop;
 for e in select * from compasso_private.items(d,'cards') loop
  perform compasso_private.amount(e->'limit');
  if (e->>'closingDay')::int not between 1 and 31 or (e->>'dueDay')::int not between 1 and 31 or not compasso_private.has(d,'banks',e->>'bankId') or (e ? 'last4' and e->>'last4' !~ '^\d{4}$') then raise exception 'Cartão inválido'; end if;
  if e ? 'holderId' and not exists(select 1 from public.finance_members where space_id=p_space and user_id::text=e->>'holderId') then raise exception 'Titular inválido'; end if;
 end loop;
 for e in select * from compasso_private.items(d,'entries') loop
  amount:=compasso_private.amount(e->'amount');
  if e ? 'plannedAmount' then perform compasso_private.amount(e->'plannedAmount'); end if;
  if length(trim(coalesce(e->>'description',''))) not between 1 and 300 or length(coalesce(e->>'notes',''))>2000 or coalesce(e->>'kind','') not in ('income','expense','refund') or coalesce(e->>'status','') not in ('pending','done','cancelled') then raise exception 'Lançamento inválido'; end if;
  if not compasso_private.valid_date(e->>'date') or coalesce(e->>'month','') !~ '^\d{4}-(0[1-9]|1[0-2])$' or (e ? 'dueDate' and not compasso_private.valid_date(e->>'dueDate')) or (e ? 'paidDate' and not compasso_private.valid_date(e->>'paidDate')) then raise exception 'Data inválida'; end if;
  if e->>'status'='done' and not e ? 'cardId' and not e ? 'paidDate' then raise exception 'Informe a data de realização'; end if;
  if not compasso_private.has(d,'banks',e->>'bankId') or not compasso_private.has(d,'cards',e->>'cardId') or not compasso_private.has(d,'series',e->>'seriesId') then raise exception 'Vínculo financeiro inválido'; end if;
  if e->>'kind'='income' and e ? 'cardId' then raise exception 'Receita não pode ser compra no cartão'; end if;
  if e ? 'installment' and (coalesce(e->>'installment','') !~ '^\d+$' or coalesce(e->>'installmentCount','') !~ '^\d+$' or (e->>'installment')::int<1 or (e->>'installmentCount')::int not between 1 and 120 or (e->>'installment')::int>(e->>'installmentCount')::int) then raise exception 'Parcela inválida'; end if;
  if not exists(select 1 from public.finance_members where space_id=p_space and user_id::text=e->>'createdBy') then raise exception 'Autor inválido'; end if;
  if jsonb_typeof(e->'allocations') is distinct from 'array' or jsonb_array_length(e->'allocations') not between 1 and 100 then raise exception 'Informe as divisões'; end if;
  total:=0;
  for a in select value from jsonb_array_elements(e->'allocations') loop
   total:=total+compasso_private.amount(a->'amount');
   select x into cat from compasso_private.items(d,'categories') x where x->>'id'=a->>'categoryId';
   if cat is null or cat->>'kind'<>(case when e->>'kind'='income' then 'income' else 'expense' end) then raise exception 'Categoria inválida'; end if;
   if a ? 'ownerId' and (a ? 'contactId' or not exists(select 1 from public.finance_members where space_id=p_space and user_id::text=a->>'ownerId')) then raise exception 'Responsável inválido'; end if;
   if a ? 'contactId' and (e->>'kind'='income' or not compasso_private.has(d,'contacts',a->>'contactId')) then raise exception 'Terceiro inválido'; end if;
  end loop;
  if total<>amount then raise exception 'As divisões devem somar o total'; end if;
  if e->>'kind'='refund' then
   select x into original from compasso_private.items(d,'entries') x where x->>'id'=e->>'originalId' and x->>'kind'='expense' and x->>'status'<>'cancelled';
   if original is null or (original->>'cardId') is distinct from (e->>'cardId') then raise exception 'Compra original do estorno inválida'; end if;
   for a in select value from jsonb_array_elements(e->'allocations') loop
    if not exists(select 1 from jsonb_array_elements(original->'allocations') x where x->>'categoryId'=a->>'categoryId' and (x->>'contactId') is not distinct from (a->>'contactId') and (x->>'ownerId') is not distinct from (a->>'ownerId')) then raise exception 'Estorno sem divisão original'; end if;
   end loop;
  end if;
 end loop;
 if exists(select 1 from compasso_private.items(d,'entries') e where e ? 'seriesId' group by e->>'seriesId',e->>'date' having count(*)>1) then raise exception 'Ocorrência duplicada'; end if;
 for e in select x from compasso_private.items(d,'entries') x where x->>'kind'='expense' loop
  for a in select value from jsonb_array_elements(e->'allocations') loop
   select coalesce(sum((x->>'amount')::bigint),0) into amount from jsonb_array_elements(e->'allocations') x where x->>'categoryId'=a->>'categoryId' and (x->>'contactId') is not distinct from (a->>'contactId') and (x->>'ownerId') is not distinct from (a->>'ownerId');
   select coalesce(sum((x->>'amount')::bigint),0) into total from compasso_private.items(d,'entries') r cross join lateral jsonb_array_elements(r->'allocations') x where r->>'originalId'=e->>'id' and r->>'status'<>'cancelled' and x->>'categoryId'=a->>'categoryId' and (x->>'contactId') is not distinct from (a->>'contactId') and (x->>'ownerId') is not distinct from (a->>'ownerId');
   if total>amount then raise exception 'Estorno excede a compra'; end if;
  end loop;
 end loop;
 for r in select * from compasso_private.items(d,'receipts') loop
  amount:=compasso_private.amount(r->'amount'); total:=0;
  if not compasso_private.valid_date(r->>'date') or not compasso_private.has(d,'banks',r->>'bankId') or jsonb_typeof(r->'allocations') is distinct from 'array' or jsonb_array_length(r->'allocations')<1 then raise exception 'Recebimento inválido'; end if;
  if exists(select 1 from jsonb_array_elements(r->'allocations') a group by a->>'entryId',a->>'contactId' having count(*)>1) then raise exception 'Divisão de recebimento duplicada'; end if;
  for a in select value from jsonb_array_elements(r->'allocations') loop
   total:=total+compasso_private.amount(a->'amount');
   if jsonb_typeof(a->'replacement') is distinct from 'boolean' or not exists(select 1 from compasso_private.items(d,'entries') e cross join lateral jsonb_array_elements(e->'allocations') x where e->>'id'=a->>'entryId' and e->>'kind'='expense' and x->>'contactId'=a->>'contactId') then raise exception 'Recebimento sem compra vinculada'; end if;
   if compasso_private.available(d,r->>'id',a->>'entryId',a->>'contactId')<0 then raise exception 'Saldo de terceiros insuficiente'; end if;
  end loop;
  if total<>amount then raise exception 'Divisões do recebimento incorretas'; end if;
 end loop;
 for p in select * from compasso_private.items(d,'payments') loop
  amount:=compasso_private.amount(p->'amount'); total:=0;
  if not compasso_private.valid_date(p->>'date') or coalesce(p->>'month','') !~ '^\d{4}-(0[1-9]|1[0-2])$' or not compasso_private.has(d,'cards',p->>'cardId') or not compasso_private.has(d,'banks',p->>'bankId') or jsonb_typeof(p->'uses') is distinct from 'array' then raise exception 'Pagamento inválido'; end if;
  for u in select value from jsonb_array_elements(p->'uses') loop
   total:=total+compasso_private.amount(u->'amount');
   if not exists(select 1 from compasso_private.items(d,'receipts') r cross join lateral jsonb_array_elements(r->'allocations') a where r->>'id'=u->>'receiptId' and r->>'date'<=p->>'date' and a->>'entryId'=u->>'entryId' and a->>'contactId'=u->>'contactId' and a->>'replacement'='false') or not exists(select 1 from compasso_private.items(d,'entries') e where e->>'id'=u->>'entryId' and e->>'cardId'=p->>'cardId' and e->>'month'=p->>'month') then raise exception 'Saldo não pertence à fatura ou data'; end if;
  end loop;
  if total>amount then raise exception 'Saldo de terceiros supera o pagamento'; end if;
 end loop;
 for r in select * from compasso_private.items(d,'returns') loop
  perform compasso_private.amount(r->'amount');
  if not compasso_private.valid_date(r->>'date') or not compasso_private.has(d,'banks',r->>'bankId') or not exists(select 1 from compasso_private.items(d,'receipts') x cross join lateral jsonb_array_elements(x->'allocations') a where x->>'id'=r->>'receiptId' and a->>'entryId'=r->>'entryId' and a->>'contactId'=r->>'contactId') then raise exception 'Devolução inválida'; end if;
 end loop;
 for e in select * from compasso_private.items(d,'series') loop
  if coalesce(e->>'frequency','') not in ('daily','weekly','monthly','yearly') or not compasso_private.valid_date(e->>'start') or not compasso_private.valid_date(e->>'generatedUntil') or (e ? 'end' and (not compasso_private.valid_date(e->>'end') or e->>'end'<e->>'start')) or jsonb_typeof(e->'archived') is distinct from 'boolean' then raise exception 'Recorrência inválida'; end if;
 end loop;
 if exists(select 1 from compasso_private.items(d,'budgets') b group by b->>'month',b->>'categoryId' having count(*)>1) then raise exception 'Orçamento duplicado'; end if;
 for e in select * from compasso_private.items(d,'budgets') loop
  perform compasso_private.amount(e->'amount');
  if coalesce(e->>'month','') !~ '^\d{4}-(0[1-9]|1[0-2])$' or not exists(select 1 from compasso_private.items(d,'categories') c where c->>'id'=e->>'categoryId' and c->>'kind'='expense' and not c ? 'parentId') then raise exception 'Orçamento inválido'; end if;
 end loop;
end $$;

create function public.finance_create_space(p_name text,p_initial jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if auth.uid() is null then raise exception 'Faça login'; end if;
 insert into public.finance_spaces(name) values(trim(p_name)) returning id into sid;
 insert into public.finance_members(space_id,user_id,name,email,role) select sid,id,coalesce(nullif(raw_user_meta_data->>'name',''),email),email,'admin' from auth.users where id=auth.uid();
 perform compasso_private.validate_document(p_initial,sid);
 if jsonb_array_length(p_initial->'entries')<>0 or jsonb_array_length(p_initial->'receipts')<>0 or jsonb_array_length(p_initial->'payments')<>0 then raise exception 'Crie o espaço sem lançamentos'; end if;
 insert into public.finance_documents(space_id,data,updated_by) values(sid,p_initial,auth.uid());
 return sid;
end $$;

create function public.finance_save(p_space uuid,p_revision bigint,p_data jsonb,p_restore boolean default false) returns bigint language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare previous public.finance_documents; role text; r jsonb; a jsonb; p jsonb; working jsonb; remaining bigint;
begin
 -- Space lock serializes financial writes and membership changes (no permission race).
 perform 1 from public.finance_spaces where id=p_space for update;
 role:=compasso_private.role_for(p_space);
 if role is null or role='reader' or (p_restore and role<>'admin') then raise exception 'Você não tem permissão para alterar este espaço'; end if;
 select * into previous from public.finance_documents where space_id=p_space for update;
 if previous.revision<>p_revision then raise exception 'CONFLICT: Outra pessoa alterou os dados. Atualize antes de salvar.'; end if;
 perform compasso_private.validate_document(p_data,p_space);
 if not p_restore then
  working:=previous.data;
  for r in select * from compasso_private.items(p_data,'receipts') loop
   if not compasso_private.has(previous.data,'receipts',r->>'id') then
    for a in select value from jsonb_array_elements(r->'allocations') loop
     if (a->>'amount')::bigint>greatest(0,compasso_private.debt(working,a->>'entryId',a->>'contactId')-compasso_private.received(working,a->>'entryId',a->>'contactId')) then raise exception 'Recebimento supera o valor devido'; end if;
    end loop;
    working:=jsonb_set(working,'{receipts}',(working->'receipts')||jsonb_build_array(r));
   elsif not exists(select 1 from compasso_private.items(previous.data,'receipts') x where x=r) then raise exception 'Recebimentos são imutáveis; desfaça o registro antes de corrigir'; end if;
  end loop;
  for p in select * from compasso_private.items(p_data,'payments') loop
   if not compasso_private.has(previous.data,'payments',p->>'id') then
    remaining:=compasso_private.invoice_remaining(working,p->>'cardId',p->>'month');
    if (p->>'amount')::bigint>remaining then raise exception 'Pagamento supera o restante da fatura'; end if;
    for a in select value from jsonb_array_elements(p->'uses') loop
     if (select sum((x->>'amount')::bigint) from jsonb_array_elements(p->'uses') x where x->>'entryId'=a->>'entryId' and x->>'contactId'=a->>'contactId') > greatest(0,compasso_private.debt(p_data,a->>'entryId',a->>'contactId') - coalesce((select sum((x->>'amount')::bigint) from compasso_private.items(working,'payments') q cross join lateral jsonb_array_elements(q->'uses') x where x->>'entryId'=a->>'entryId' and x->>'contactId'=a->>'contactId'),0)) then raise exception 'Uso de terceiros supera a obrigação restante'; end if;
    end loop;
    working:=jsonb_set(working,'{payments}',(working->'payments')||jsonb_build_array(p));
   elsif not exists(select 1 from compasso_private.items(previous.data,'payments') x where x=p) then raise exception 'Pagamentos são imutáveis; desfaça o registro antes de corrigir'; end if;
  end loop;
  -- Do not erase entries with receipts/refunds or change the debt of an already-paid invoice except via refund.
  for r in select * from compasso_private.items(p_data,'entries') loop
   if not compasso_private.has(previous.data,'entries',r->>'id') and r->>'createdBy'<>auth.uid()::text then raise exception 'Autor do registro inválido'; end if;
   if exists(select 1 from compasso_private.items(previous.data,'entries') x where x->>'id'=r->>'id' and x->>'createdBy'<>r->>'createdBy') then raise exception 'Preserve o autor original'; end if;
  end loop;
  for r in select * from compasso_private.items(previous.data,'entries') loop
   if not exists(select 1 from compasso_private.items(p_data,'entries') x where x=r) and (
    exists(select 1 from compasso_private.items(previous.data,'receipts') x cross join lateral jsonb_array_elements(x->'allocations') a where a->>'entryId'=r->>'id') or
    exists(select 1 from compasso_private.items(previous.data,'entries') x where x->>'originalId'=r->>'id') or
    exists(select 1 from compasso_private.items(previous.data,'payments') x where x->>'cardId'=r->>'cardId' and x->>'month'=r->>'month')
   ) then raise exception 'Lançamento possui vínculos: use estorno ou desfaça os registros relacionados'; end if;
  end loop;
  for r in select * from compasso_private.items(p_data,'returns') loop
   if not compasso_private.has(previous.data,'returns',r->>'id') then
    if (r->>'amount')::bigint>greatest(0,compasso_private.received(working,r->>'entryId',r->>'contactId')-compasso_private.debt(working,r->>'entryId',r->>'contactId')) then raise exception 'Devolução supera o valor excedente recebido'; end if;
    working:=jsonb_set(working,'{returns}',(working->'returns')||jsonb_build_array(r));
   elsif not exists(select 1 from compasso_private.items(previous.data,'returns') x where x=r) then raise exception 'Devoluções são imutáveis'; end if;
  end loop;
 end if;
 insert into public.finance_history(space_id,revision,data,changed_by) values(p_space,previous.revision,previous.data,auth.uid());
 update public.finance_documents set data=p_data,revision=revision+1,updated_at=now(),updated_by=auth.uid() where space_id=p_space;
 return previous.revision+1;
end $$;

create function public.finance_invite(p_space uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare invite_token uuid;
begin
 perform 1 from public.finance_spaces where id=p_space for update;
 if compasso_private.role_for(p_space) is distinct from 'admin' then raise exception 'Somente administradores podem convidar'; end if;
 if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'E-mail inválido'; end if;
 insert into public.finance_invites(space_id,email,role,created_by) values(p_space,lower(trim(p_email)),p_role,auth.uid()) returning token into invite_token;
 return invite_token;
end $$;
create function public.finance_accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.finance_invites; sid uuid; usr auth.users;
begin
 if auth.uid() is null then raise exception 'Faça login para aceitar o convite'; end if;
 select space_id into sid from public.finance_invites where token=p_token;
 perform 1 from public.finance_spaces where id=sid for update;
 select * into inv from public.finance_invites where token=p_token for update;
 select * into usr from auth.users where id=auth.uid();
 if inv.id is null or inv.accepted or inv.expires_at<now() or lower(usr.email)<>inv.email or usr.email_confirmed_at is null then raise exception 'Convite expirado, utilizado ou destinado a outro e-mail. Confirme seu e-mail.'; end if;
 if inv.role<>'admin' and exists(select 1 from public.finance_members where space_id=inv.space_id and user_id=usr.id and active and role='admin') and (select count(*) from public.finance_members where space_id=inv.space_id and active and role='admin')<=1 then raise exception 'Não é permitido rebaixar o último administrador por convite'; end if;
 insert into public.finance_members(space_id,user_id,name,email,role,active) values(inv.space_id,usr.id,coalesce(nullif(usr.raw_user_meta_data->>'name',''),usr.email),usr.email,inv.role,true)
 on conflict(space_id,user_id) do update set role=excluded.role,active=true;
 update public.finance_invites set accepted=true where id=inv.id;
 return inv.space_id;
end $$;
create function public.finance_set_member(p_space uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare target public.finance_members;
begin
 perform 1 from public.finance_spaces where id=p_space for update;
 if compasso_private.role_for(p_space) is distinct from 'admin' then raise exception 'Somente administradores podem gerenciar participantes'; end if;
 select * into target from public.finance_members where space_id=p_space and user_id=p_user;
 if target.user_id is null then raise exception 'Participante não encontrado'; end if;
 if target.active and target.role='admin' and (not p_active or p_role<>'admin') and (select count(*) from public.finance_members where space_id=p_space and active and role='admin')<=1 then raise exception 'Não é permitido remover ou rebaixar o último administrador'; end if;
 update public.finance_members set role=p_role,active=p_active where space_id=p_space and user_id=p_user;
 if not p_active then update public.finance_invites set accepted=true where space_id=p_space and email=target.email and not accepted; end if;
end $$;

revoke all on all functions in schema compasso_private from public,anon,authenticated;
revoke all on function public.finance_can_read(uuid),public.finance_is_admin(uuid),public.finance_create_space(text,jsonb),public.finance_save(uuid,bigint,jsonb,boolean),public.finance_invite(uuid,text,text),public.finance_accept_invite(uuid),public.finance_set_member(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.finance_can_read(uuid),public.finance_is_admin(uuid),public.finance_create_space(text,jsonb),public.finance_save(uuid,bigint,jsonb,boolean),public.finance_invite(uuid,text,text),public.finance_accept_invite(uuid),public.finance_set_member(uuid,uuid,text,boolean) to authenticated;
commit;
