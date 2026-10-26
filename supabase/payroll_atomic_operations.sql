-- Atomic payroll release and deletion. Apply after schema.sql, sinking_fund.sql,
-- app_tables.sql, and weekly_sinking_contribution.sql.
-- These functions preserve the existing payslip deduction details and amounts.

create or replace function public.release_payroll_payslips(p_ids uuid[], p_actor text default 'payroll-system')
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_slip public.payslips%rowtype;
  v_detail jsonb;
  v_details jsonb;
  v_amount numeric(14,2);
  v_reference text;
  v_notes text;
  v_released integer := 0;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 100 then
    raise exception 'Provide between 1 and 100 payslip IDs';
  end if;

  for v_id in select distinct x from unnest(p_ids) as ids(x) order by x loop
    select * into v_slip from public.payslips where id = v_id for update;
    if not found or v_slip.status = 'Released' then
      continue;
    end if;

    v_details := coalesce(nullif(v_slip.deduction_details, '')::jsonb, '[]'::jsonb);
    if jsonb_typeof(v_details) <> 'array' then
      raise exception 'Payslip % has invalid deduction details', v_id;
    end if;

    for v_detail in select value from jsonb_array_elements(v_details) loop
      if coalesce(v_detail->>'skipped', 'false') = 'true' then
        continue;
      end if;
      v_amount := round(coalesce(nullif(v_detail->>'amount', '')::numeric, 0), 2);
      if v_detail->>'source' = 'sinkingFund' then
        if exists (select 1 from public.sf_loans where id = (v_detail->>'id')::uuid) then
          v_reference := 'PAYSLIP-' || v_id::text || '-' || (v_detail->>'id');
          if not exists (select 1 from public.sf_payments where reference_no = v_reference) then
            insert into public.sf_payments
              (loan_id, paid_on, amount, late_fee, reference_no, notes, prepay_interest)
            values
              ((v_detail->>'id')::uuid,
               coalesce(nullif(v_detail->>'paidOn', '')::date, (now() at time zone 'Asia/Manila')::date),
               v_amount, 0, v_reference, 'Payroll deduction from payslip ' || v_id::text, false);
            insert into public.sf_audit_log(action, entity, entity_id, details, actor)
            values ('Payroll loan deduction recorded', 'loans', v_detail->>'id',
                    'Payroll payslip ' || v_id::text || ': PHP ' || to_char(v_amount, 'FM999999999990.00'),
                    'payroll-system');
          end if;
        end if;
      elsif v_detail->>'source' = 'sinkingContribution' then
        if exists (select 1 from public.sf_members where id = (v_detail->>'id')::uuid) then
          v_reference := 'PAYSLIP-' || v_id::text || '-' || (v_detail->>'id');
          v_notes := 'Weekly base contribution deducted from released payslip ' || v_id::text ||
            '; payroll range ' || coalesce(v_detail->>'periodStart', '-') || ' to ' ||
            coalesce(v_detail->>'periodEnd', v_detail->>'paidOn', '-');
          if exists (select 1 from public.sf_contributions where reference_no = v_reference) then
            update public.sf_contributions set notes = v_notes where reference_no = v_reference;
          else
            insert into public.sf_contributions
              (member_id, amount, contributed_on, payroll_period_start, payroll_period_end, reference_no, notes)
            values
              ((v_detail->>'id')::uuid, v_amount,
               coalesce(nullif(v_detail->>'paidOn', '')::date, (now() at time zone 'Asia/Manila')::date),
               nullif(v_detail->>'periodStart', '')::date,
               coalesce(nullif(v_detail->>'periodEnd', '')::date, nullif(v_detail->>'paidOn', '')::date),
               v_reference, v_notes);
            insert into public.sf_audit_log(action, entity, entity_id, details, actor)
            values ('Payroll sinking contribution recorded', 'contributions', v_detail->>'id',
                    'Payslip ' || v_id::text || ': PHP ' || to_char(v_amount, 'FM999999999990.00'),
                    'payroll-system');
          end if;
        end if;
      else
        update public.cash_advances
        set balance = greatest(0, round((coalesce(balance, 0) - v_amount)::numeric, 2)),
            status = case when greatest(0, round((coalesce(balance, 0) - v_amount)::numeric, 2)) <= 0 then 'Paid' else 'Active' end
        where id = (v_detail->>'id')::uuid;
      end if;
    end loop;

    update public.payslips set status = 'Released' where id = v_id;
    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;

create or replace function public.delete_payslip_with_ledger(p_id uuid, p_actor text default 'payroll-system')
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_slip public.payslips%rowtype;
  v_detail jsonb;
  v_details jsonb;
  v_amount numeric(14,2);
  v_marker text;
  v_payment record;
  v_contribution record;
begin
  select * into v_slip from public.payslips where id = p_id for update;
  if not found then
    return true;
  end if;
  v_details := coalesce(nullif(v_slip.deduction_details, '')::jsonb, '[]'::jsonb);
  if jsonb_typeof(v_details) <> 'array' then
    raise exception 'Payslip % has invalid deduction details', p_id;
  end if;
  v_marker := 'PAYSLIP-' || p_id::text || '-';

  if v_slip.status = 'Released' then
    for v_detail in select value from jsonb_array_elements(v_details) loop
      if coalesce(v_detail->>'skipped', 'false') = 'true' or
         v_detail->>'source' in ('sinkingFund', 'sinkingContribution') then
        continue;
      end if;
      v_amount := round(coalesce(nullif(v_detail->>'amount', '')::numeric, 0), 2);
      update public.cash_advances
      set balance = greatest(0, round((coalesce(balance, 0) + v_amount)::numeric, 2)),
          status = case when greatest(0, round((coalesce(balance, 0) + v_amount)::numeric, 2)) <= 0 then 'Paid' else 'Active' end
      where id = (v_detail->>'id')::uuid;
    end loop;
  end if;

  if v_slip.status = 'Released' then
    for v_payment in delete from public.sf_payments where reference_no like v_marker || '%' returning * loop
      insert into public.sf_audit_log(action, entity, entity_id, details, actor)
      values ('Payroll loan deduction reversed', 'loans', v_payment.loan_id::text,
              'Deleted released payslip ' || p_id::text || '; reversed PHP ' || to_char(coalesce(v_payment.amount, 0), 'FM999999999990.00'),
              'payroll-system');
    end loop;
    for v_contribution in delete from public.sf_contributions where reference_no like v_marker || '%' returning * loop
      insert into public.sf_audit_log(action, entity, entity_id, details, actor)
      values ('Payroll sinking contribution reversed', 'contributions', v_contribution.member_id::text,
              'Deleted released payslip ' || p_id::text || '; reversed PHP ' || to_char(coalesce(v_contribution.amount, 0), 'FM999999999990.00'),
              'payroll-system');
    end loop;
  elsif exists (
    select 1 from jsonb_array_elements(v_details) d
    where d->>'source' = 'sinkingContribution'
  ) then
    delete from public.sf_contributions where reference_no like v_marker || '%';
  end if;

  delete from public.payslips where id = p_id;
  return true;
end;
$$;

revoke all on function public.release_payroll_payslips(uuid[], text) from public, anon, authenticated;
revoke all on function public.delete_payslip_with_ledger(uuid, text) from public, anon, authenticated;
grant execute on function public.release_payroll_payslips(uuid[], text) to service_role;
grant execute on function public.delete_payslip_with_ledger(uuid, text) to service_role;
