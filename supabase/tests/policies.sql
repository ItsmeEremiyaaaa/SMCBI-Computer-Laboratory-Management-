-- Security checks for 0001_init.sql. Paste the whole file into the Supabase SQL Editor and click Run.
--
-- The check is ONE block that always ends by raising an error, so everything it did is undone,
-- however the editor runs it. The "error" message IS the report: every line should start with PASS.

-- Remove leftover test accounts from an earlier version of this script (only these 3 addresses).
delete from auth.users where email in ('zz-admin@smcbi.edu.ph', 'zz-teacher@smcbi.edu.ph', 'zz-pending@smcbi.edu.ph');

do $test$
declare
  report text := '';
  n int;
  admin_id constant uuid := '00000000-0000-0000-0000-00000000000a';
  teacher_id constant uuid := '00000000-0000-0000-0000-00000000000b';
  pending_id constant uuid := '00000000-0000-0000-0000-00000000000c';
  r1 constant uuid := '00000000-0000-0000-0000-0000000000e1';
  r2 constant uuid := '00000000-0000-0000-0000-0000000000e2';
  r3 constant uuid := '00000000-0000-0000-0000-0000000000e3';
  day date := current_date + 30;

begin

  insert into auth.users (id, email, raw_user_meta_data) values
    (admin_id, 'zz-admin@smcbi.edu.ph', '{"full_name":"Test Admin"}'),
    (teacher_id, 'zz-teacher@smcbi.edu.ph', '{"full_name":"Test Teacher"}'),
    (pending_id, 'zz-pending@smcbi.edu.ph', '{"full_name":"Pending Teacher"}');
  -- no signed-in user here, like the SQL Editor: promoting the first admin must work
  update public.profiles set role = 'admin', approved = true where id = admin_id;
  update public.profiles set approved = true where id = teacher_id;
  report := report || E'\n' || (case when (select role = 'admin' and approved from public.profiles where id = admin_id) then 'PASS' else 'FAIL' end) || ' first admin can be promoted from the SQL Editor';

  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'x@gmail.com');
    report := report || E'\nFAIL gmail sign-up rejected';
  exception when others then report := report || E'\nPASS gmail sign-up rejected'; end;

  -- ===== act as the pending (unapproved) teacher =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pending_id, 'role', 'authenticated')::text, true);
  begin
    insert into public.reservations (title, lab_id, purpose, date, start_time, end_time) values ('x', 'lab1', 'y', day, '08:00', '10:00');
    report := report || E'\nFAIL pending teacher cannot reserve';
  exception when others then report := report || E'\nPASS pending teacher cannot reserve'; end;
  select count(*) into n from public.pcs;
  report := report || E'\n' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' pending teacher sees no PCs';
  select count(*) into n from public.reservations;
  report := report || E'\n' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' pending teacher sees no reservations';

  -- ===== act as the approved teacher =====
  perform set_config('request.jwt.claims', json_build_object('sub', teacher_id, 'role', 'authenticated')::text, true);
  update public.pcs set status = 'broken' where id = 'lab1-pc01';
  get diagnostics n = row_count;
  report := report || E'\n' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' teacher cannot change PC status';

  -- tries to spoof requester and self-approve on insert
  insert into public.reservations (id, title, lab_id, pc_id, purpose, date, start_time, end_time, status, requester_id) values
    (r1, 'Whole lab', 'lab1', null, 'class', day, '08:00', '10:00', 'approved', admin_id),
    (r2, 'One PC', 'lab1', 'lab1-pc05', 'thesis', day, '09:00', '11:00', 'pending', admin_id),
    (r3, 'Early PC', 'lab2', 'lab2-pc05', 'thesis', day, '08:00', '10:00', 'pending', admin_id);
  select count(*) into n from public.reservations
   where id in (r1, r2, r3) and status = 'pending' and requester_id = teacher_id and requester_name = 'Test Teacher';
  report := report || E'\n' || (case when n = 3 then 'PASS' else 'FAIL' end) || ' new requests forced to pending, requester = the signed-in teacher';

  update public.reservations set status = 'approved' where id = r1;
  get diagnostics n = row_count;
  report := report || E'\n' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' teacher cannot approve';

  begin
    update public.profiles set role = 'admin' where id = teacher_id;
    report := report || E'\nFAIL teacher cannot promote self';
  exception when others then report := report || E'\nPASS teacher cannot promote self'; end;

  select count(*) into n from public.students;
  report := report || E'\n' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' teacher cannot read students';

  -- ===== act as admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  update public.reservations set status = 'approved' where id = r1;
  report := report || E'\n' || (case when (select status = 'approved' and reviewed_by = admin_id from public.reservations where id = r1) then 'PASS' else 'FAIL' end) || ' admin can approve';

  begin
    update public.reservations set status = 'approved' where id = r2;
    report := report || E'\nFAIL PC booking inside an approved whole-lab booking is rejected';
  exception when others then report := report || E'\n' || (case when sqlerrm = 'conflict' then 'PASS' else 'FAIL (' || sqlerrm || ')' end) || ' PC booking inside an approved whole-lab booking is rejected'; end;

  -- reverse direction: approved PC booking blocks a later whole-lab booking
  update public.reservations set status = 'approved' where id = r3;
  insert into public.reservations (title, lab_id, purpose, date, start_time, end_time) values ('Class', 'lab2', 'class', day, '09:00', '11:00');
  begin
    update public.reservations set status = 'approved' where lab_id = 'lab2' and pc_id is null and date = day;
    report := report || E'\nFAIL whole-lab booking over an approved PC booking is rejected';
  exception when others then report := report || E'\n' || (case when sqlerrm = 'conflict' then 'PASS' else 'FAIL (' || sqlerrm || ')' end) || ' whole-lab booking over an approved PC booking is rejected'; end;

  update public.pcs set status = 'broken' where id = 'lab1-pc01';
  get diagnostics n = row_count;
  report := report || E'\n' || (case when n = 1 then 'PASS' else 'FAIL' end) || ' admin can change PC status';

  delete from public.reservations where id = r1;
  get diagnostics n = row_count;
  report := report || E'\n' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' approved booking cannot be deleted';

  -- Always abort: undoes every change above. The message is the report.
  raise exception 'POLICY CHECK REPORT (all changes undone):%', report;
end
$test$;
