# Task App – Mejoras (tarea del 24 de noviembre)

Rama de git: `feature/subtasks-ai-github-login`

## 1. Función nueva con datos nuevos en la base: "Steps" (subtareas)

En la página de cada tarea (`/task?id=...`) hay una sección nueva **Steps**: una
lista de pasos con casillas, una barra de progreso ("2 of 5 done") y un cuadro para
agregar pasos a mano.

**Tabla nueva:** `public.subtasks` (no existía en el task app original).
Archivo: `supabase/migrations/9_init_subtasks.sql`

| Columna | Tipo | Para qué sirve |
|---|---|---|
| `subtask_id` | uuid | id único de cada paso |
| `task_id` | uuid → `tasks.task_id` | a qué tarea pertenece (si se borra la tarea, se borran sus pasos) |
| `user_id` | uuid → `profiles.user_id` | dueño del paso; la política de seguridad (RLS) solo deja ver/editar los propios |
| `title` | text | el texto del paso |
| `completed` | boolean | si el paso ya está hecho |
| `position` | integer | el orden en la lista |
| `ai_generated` | boolean | `true` si lo escribió OpenAI, `false` si lo escribió el usuario |
| `created_at` | timestamptz | cuándo se guardó |

Por qué está ahí: cada vez que marcas una casilla o agregas un paso, la app
guarda o cambia una fila en `subtasks`. Lo puedes ver en Supabase → Table Editor →
`subtasks`.

## 2. Uso nuevo de la API de OpenAI: "Break down with AI"

El botón **Break down with AI** llama a la Edge Function nueva
`supabase/functions/generate-subtasks`. Esa función lee el título y la descripción
de la tarea, le pide a OpenAI (gpt-4o-mini) entre 3 y 7 pasos concretos en
formato JSON, y los guarda en la tabla `subtasks` con `ai_generated = true`
(salen con la etiqueta ✨ AI).

En qué se diferencia del original: el task app original le pide a OpenAI **una
sola palabra** (la etiqueta). Esta función le pide una **lista estructurada en
JSON** y guarda **varias filas** en una tabla nueva. Si ya hay pasos, se los pasa a
la IA para que no los repita, y responde en el idioma de la tarea.

## 3. Login nuevo con GitHub (OAuth)

En la página de inicio hay un botón **Login with GitHub** debajo del de Google
(`hooks/useAuth.ts` → `handleGitHubLogin`, `components/LoginForm.tsx`).

---

## Pasos que tienes que hacer tú (en orden)

### A. Subir la tabla nueva a Supabase
```
npx supabase db push
```
Luego revisa en Supabase → Table Editor que aparezca `subtasks`.

### B. Subir la función nueva de OpenAI
```
npx supabase functions deploy generate-subtasks
```
Usa el mismo secreto `OPENAI_API_KEY` que ya tienes; no hay que configurar nada más.

### C. Configurar GitHub OAuth
1. Supabase → Authentication → Sign In / Providers → **GitHub**. Copia el
   **Callback URL** (algo como `https://XXXX.supabase.co/auth/v1/callback`).
2. GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**:
   - Application name: `Task App`
   - Homepage URL: tu URL de Vercel
   - Authorization callback URL: el Callback URL del paso 1
   - Register application
3. En la app de GitHub: copia el **Client ID** y haz clic en
   **Generate a new client secret** y cópialo.
4. Vuelve a Supabase → GitHub: activa **Enable**, pega Client ID y Client Secret,
   **Save**.
5. Supabase → Authentication → URL Configuration: confirma que
   `http://localhost:3000/**` y tu URL de Vercel `/**` estén en **Redirect URLs**
   (ya deberían estar por Google).

📸 Toma capturas de: la OAuth App en GitHub (sin mostrar el secret) y el
proveedor GitHub activado en Supabase.

### D. Probar en tu computadora
```
npm run dev
```
- Entra con GitHub.
- Abre una tarea → **Break down with AI** → marca algunos pasos → agrega uno a mano.
- 📸 Capturas: la sección Steps con pasos de IA, la barra de progreso, y la tabla
  `subtasks` en Supabase con datos.

### E. Publicar
Cuando todo funcione: commit, push, y Vercel publica (si Vercel publica desde
`main`, hay que unir la rama a `main` primero).
