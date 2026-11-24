-- Subtasks: the smaller steps that make up a task.
--
-- NEW in the "task-app improvements" homework. The original task app had no
-- place to store steps, so this migration adds a new table, public.subtasks.
-- A user can add steps by hand, or ask OpenAI to break a task into steps
-- (Edge Function generate-subtasks), and check each step off when it's done.
--
-- New table and columns:
--   subtask_id  a unique id for each step
--   task_id     which task the step belongs to (deleting the task deletes its steps)
--   user_id     who owns the step (used by the security policy below)
--   title       the text of the step, for example "Buy a birthday card"
--   completed   whether the step is done
--   position    the step's place in the list (1, 2, 3, ...)
--   ai_generated true if OpenAI wrote the step, false if the user typed it
--   created_at  when the step was saved
create table public.subtasks (
  subtask_id uuid default gen_random_uuid() primary key,
  task_id uuid not null references public.tasks (task_id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  completed boolean not null default false,
  position integer not null default 0,
  ai_generated boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index subtasks_task_id_idx on public.subtasks (task_id, position);

-- Security policy: users can read, add, change and delete only their own steps,
-- and only on their own tasks.
create policy "Users can CRUD own subtasks"
on public.subtasks for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.tasks t
    where t.task_id = subtasks.task_id and t.user_id = auth.uid()
  )
);

-- Enable RLS
alter table public.subtasks enable row level security;
