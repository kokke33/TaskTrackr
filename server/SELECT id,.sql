SELECT id,
       project_name,
       case_name,
       description,
       created_at,
       is_deleted,
       milestone
FROM public.cases
LIMIT 1000;