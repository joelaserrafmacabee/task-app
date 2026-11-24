// Edge Function: generate-subtasks
//
// NEW in the "task-app improvements" homework. It asks OpenAI to break one of the
// user's tasks into a short checklist of concrete steps, saves the steps in the
// new public.subtasks table, and returns them.
//
// (The original function, create-task-with-ai, asks OpenAI for one label. This
// one asks for a structured list in JSON and stores several rows.)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai";
import { SUPABASE_PUBLISHABLE_KEY } from "../_shared/supabaseKeys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-4o-mini";

const MIN_STEPS = 3;
const MAX_STEPS = 7;
const MAX_STEP_LENGTH = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { task_id } = await req.json();
    if (!task_id) throw new Error("task_id is required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    // Act as the signed-in user, so Row Level Security applies.
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("No user found");

    // Read the task. RLS returns nothing if it isn't this user's task.
    const { data: task, error: taskError } = await supabaseClient
      .from("tasks")
      .select("task_id, title, description, due_date")
      .eq("task_id", task_id)
      .single();
    if (taskError || !task) throw new Error("Task not found");

    // Steps that already exist, so the AI doesn't repeat them.
    const { data: existing } = await supabaseClient
      .from("subtasks")
      .select("title, position")
      .eq("task_id", task_id)
      .order("position", { ascending: true });
    const existingTitles = (existing ?? []).map((s) => s.title);
    const nextPosition =
      (existing ?? []).reduce((max, s) => Math.max(max, s.position), 0) + 1;

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const prompt = `You help people get things done by breaking a task into small, concrete steps.

Task title: "${task.title}"
Task description: "${task.description ?? ""}"
${task.due_date ? `Due date: ${task.due_date}` : ""}
${existingTitles.length ? `Steps the user already has (do not repeat them):\n- ${existingTitles.join("\n- ")}` : ""}

Write between ${MIN_STEPS} and ${MAX_STEPS} steps, in the order the user should do them.
Each step starts with a verb, is specific and short (under 12 words), and can be checked off.
Reply in the same language as the task title.
Reply with JSON only, in this shape: {"steps": ["first step", "second step"]}`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 400,
    });

    const content = completion.choices[0].message.content ?? "{}";
    console.log("✨ AI steps:", content);

    let steps: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.steps)) {
        steps = parsed.steps
          .filter((s: unknown): s is string => typeof s === "string")
          .map((s: string) => s.trim().slice(0, MAX_STEP_LENGTH))
          .filter((s: string) => s.length > 0)
          .slice(0, MAX_STEPS);
      }
    } catch {
      throw new Error("The AI reply was not valid JSON");
    }
    if (steps.length === 0) throw new Error("The AI did not suggest any steps");

    const rows = steps.map((title, i) => ({
      task_id,
      user_id: user.id,
      title,
      position: nextPosition + i,
      ai_generated: true,
    }));

    const { data: inserted, error: insertError } = await supabaseClient
      .from("subtasks")
      .insert(rows)
      .select()
      .order("position", { ascending: true });
    if (insertError) throw insertError;

    return jsonResponse(inserted);
  } catch (error) {
    const message = (error as { message?: string })?.message ?? String(error);
    console.error("Error in generate-subtasks:", message);
    return jsonResponse({ error: message }, 400);
  }
});
