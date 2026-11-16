-- Security checks for 0001_init.sql. Runs in a transaction and rolls back; every row should say ok = true.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'zz-admin@smcbi.edu.ph', '{"full_name":"Test Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'zz-teacher@smcbi.edu.ph', '{"full_name":"Test Teacher"}'),
  ('00000000-0000-0000-0000-00000000000c', 'zz-pending@smcbi.edu.ph', '{"full_name":"Pending Teacher"}');
update public.profiles set role = 'admin', approved = true where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set approved = true where id = '00000000-0000-0000-0000-00000000000b';

create temp table results (check_name text, ok boolean);
grant all on results to authenticated;

-- Non-school email can't register
do $$ begin
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'x@gmail.com');
  insert into results values ('gmail sign-up rejected', false);
exception when others then insert into results values ('gmail sign-up rejected', true); end $$;

set local role authenticated;

-- Pending teacher
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$ begin
  insert into public.reservations (title, lab_id, purpose, date, start_time, end_time)
  values ('x', 'lab1', 'y', current_date + 30, '08:00', '10:00');
  insert into results values ('pending teacher cannot reserve', false);
exception when others then insert into results values ('pending teacher cannot reserve', true); end $$;
insert into results select 'pending teacher sees no PCs', count(*) = 0 from public.pcs;

-- Approved teacher
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ declare n int; begin
  update public.pcs set status = 'broken' where id = 'lab1-pc01';
  get diagnostics n = row_count;
  insert into results values ('teacher cannot change PC status', n = 0);
end $$;
insert into public.reservations (id, title, lab_id, purpose, date, start_time, end_time, status, requester_id)
values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Whole lab', 'lab1', 'class', current_date + 30, '08:00', '10:00', 'approved', '00000000-0000-0000-0000-00000000000a'),
       ('00000000-0000-0000-0000-0000000000e2'::uuid, 'One PC', 'lab1', 'thesis', current_date + 30, '09:00', '11:00', 'pending', '00000000-0000-0000-0000-00000000000a');
insert into results select 'insert forced to pending + self as requester',
  bool_and(status = 'pending' and requester_id = '00000000-0000-0000-0000-00000000000b' and requester_name = 'Test Teacher')
  from public.reservations where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');
do $$ declare n int; begin
  update public.reservations set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  insert into results values ('teacher cannot approve', n = 0);
end $$;
do $$ begin
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b';
  insert into results values ('teacher cannot promote self', false);
exception when others then insert into results values ('teacher cannot promote self', true); end $$;
insert into results select 'teacher cannot read students', count(*) = 0 from public.students;

-- Admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
reset role; update public.reservations set pc_id = 'lab1-pc05' where id = '00000000-0000-0000-0000-0000000000e2'; set local role authenticated;
update public.reservations set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e1';
insert into results select 'admin can approve', status = 'approved' and reviewed_by = '00000000-0000-0000-0000-00000000000a'
  from public.reservations where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  update public.reservations set status = 'approved' where id = '00000000-0000-0000-0000-0000000000e2';
  insert into results values ('PC booking inside approved whole-lab booking is rejected', false);
exception when others then insert into results values ('PC booking inside approved whole-lab booking is rejected', sqlerrm = 'conflict'); end $$;
do $$ declare n int; begin
  update public.pcs set status = 'broken' where id = 'lab1-pc01';
  get diagnostics n = row_count;
  insert into results values ('admin can change PC status', n = 1);
end $$;
do $$ begin
  delete from public.reservations where id = '00000000-0000-0000-0000-0000000000e1';
  insert into results values ('approved booking cannot be deleted', not found);
end $$;

reset role;
select * from results order by ok, check_name;
rollback;
