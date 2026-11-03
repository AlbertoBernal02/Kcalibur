-- Las series importadas desde un Excel no tienen fecha real: logged_on pasa a admitir nulo (el calendario las ignora).
alter table public.set_logs alter column logged_on drop not null;
alter table public.set_logs alter column logged_on drop default;
-- Hasta ahora todas las filas existentes vienen de importaciones (llevan el texto original en note).
update public.set_logs set logged_on = null where note <> '';
