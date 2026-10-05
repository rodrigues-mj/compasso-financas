-- Harden invitation acceptance and invalidate outstanding invitations on revocation.
begin;
create or replace function public.finance_accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
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
create or replace function public.finance_set_member(p_space uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
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
commit;
