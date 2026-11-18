-- Admins can delete handled problem reports for good (Archive → Handled reports). Open reports stay.
drop policy if exists "admin delete handled" on public.pc_reports;
create policy "admin delete handled" on public.pc_reports for delete
  using (public.has_role('admin') and resolved_at is not null);
