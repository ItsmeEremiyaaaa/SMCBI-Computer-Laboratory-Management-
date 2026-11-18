-- One-click maintenance: PCs can be 'maintenance', and setting a PC back to Free closes its open
-- reports as 'fixed' (so the student who reported it is told). Both were refused by the old checks.
alter table public.pcs drop constraint if exists pcs_status_check;
alter table public.pcs add constraint pcs_status_check
  check (status in ('free', 'in_use', 'broken', 'maintenance'));

alter table public.pc_reports drop constraint if exists pc_reports_resolution_check;
alter table public.pc_reports add constraint pc_reports_resolution_check
  check (resolution in ('broken', 'dismissed', 'fixed'));
