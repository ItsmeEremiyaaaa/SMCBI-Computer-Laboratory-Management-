-- Netlab from the room sketch: left 4 rows x 3, centre 2 rows x 3, right 4 rows x 3 = 30 PCs.
-- PC-01 to PC-30 keep their id and status and move to their real spot.
-- PC-31 to PC-42 no longer exist and are removed (any bookings made for those 12 PCs are removed with them).

update public.pcs set row = row + 1000 where lab_id = 'netlab';
update public.labs set rows = 4, cols = 11 where id = 'netlab';

insert into public.pcs (id, lab_id, label, row, col) values
  ('netlab-pc01', 'netlab', 'PC-01', 0, 0),
  ('netlab-pc02', 'netlab', 'PC-02', 0, 1),
  ('netlab-pc03', 'netlab', 'PC-03', 0, 2),
  ('netlab-pc04', 'netlab', 'PC-04', 0, 8),
  ('netlab-pc05', 'netlab', 'PC-05', 0, 9),
  ('netlab-pc06', 'netlab', 'PC-06', 0, 10),
  ('netlab-pc07', 'netlab', 'PC-07', 1, 0),
  ('netlab-pc08', 'netlab', 'PC-08', 1, 1),
  ('netlab-pc09', 'netlab', 'PC-09', 1, 2),
  ('netlab-pc10', 'netlab', 'PC-10', 1, 4),
  ('netlab-pc11', 'netlab', 'PC-11', 1, 5),
  ('netlab-pc12', 'netlab', 'PC-12', 1, 6),
  ('netlab-pc13', 'netlab', 'PC-13', 1, 8),
  ('netlab-pc14', 'netlab', 'PC-14', 1, 9),
  ('netlab-pc15', 'netlab', 'PC-15', 1, 10),
  ('netlab-pc16', 'netlab', 'PC-16', 2, 0),
  ('netlab-pc17', 'netlab', 'PC-17', 2, 1),
  ('netlab-pc18', 'netlab', 'PC-18', 2, 2),
  ('netlab-pc19', 'netlab', 'PC-19', 2, 4),
  ('netlab-pc20', 'netlab', 'PC-20', 2, 5),
  ('netlab-pc21', 'netlab', 'PC-21', 2, 6),
  ('netlab-pc22', 'netlab', 'PC-22', 2, 8),
  ('netlab-pc23', 'netlab', 'PC-23', 2, 9),
  ('netlab-pc24', 'netlab', 'PC-24', 2, 10),
  ('netlab-pc25', 'netlab', 'PC-25', 3, 0),
  ('netlab-pc26', 'netlab', 'PC-26', 3, 1),
  ('netlab-pc27', 'netlab', 'PC-27', 3, 2),
  ('netlab-pc28', 'netlab', 'PC-28', 3, 8),
  ('netlab-pc29', 'netlab', 'PC-29', 3, 9),
  ('netlab-pc30', 'netlab', 'PC-30', 3, 10)
on conflict (id) do update set label = excluded.label, row = excluded.row, col = excluded.col;

delete from public.pcs where lab_id = 'netlab' and id not in ('netlab-pc01', 'netlab-pc02', 'netlab-pc03', 'netlab-pc04', 'netlab-pc05', 'netlab-pc06', 'netlab-pc07', 'netlab-pc08', 'netlab-pc09', 'netlab-pc10', 'netlab-pc11', 'netlab-pc12', 'netlab-pc13', 'netlab-pc14', 'netlab-pc15', 'netlab-pc16', 'netlab-pc17', 'netlab-pc18', 'netlab-pc19', 'netlab-pc20', 'netlab-pc21', 'netlab-pc22', 'netlab-pc23', 'netlab-pc24', 'netlab-pc25', 'netlab-pc26', 'netlab-pc27', 'netlab-pc28', 'netlab-pc29', 'netlab-pc30');

-- Check: should show lab1 40, lab2 44, netlab 30.
select lab_id, count(*) from public.pcs group by lab_id order by lab_id;
