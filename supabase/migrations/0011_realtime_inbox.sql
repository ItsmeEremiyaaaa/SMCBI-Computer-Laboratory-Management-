-- Live notifications: problem reports and account sign-ups reach open screens without a reload.
do $$ begin
  begin alter publication supabase_realtime add table public.pc_reports; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;
