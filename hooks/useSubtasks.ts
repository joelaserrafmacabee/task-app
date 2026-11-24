import { useState, useEffect, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Subtask } from "@/types/models";

const GENERATE_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-subtasks`;

// Reads and changes the steps (subtasks) of one task. Steps live in the
// public.subtasks table (supabase/migrations/9_init_subtasks.sql).
export function useSubtasks(taskId: string | undefined) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      ),
    []
  );

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) return;
    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });
    if (error) {
      console.error("Error fetching subtasks:", error);
    } else {
      setSubtasks(data || []);
    }
    setIsLoading(false);
  }, [supabase, taskId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const addSubtask = async (title: string) => {
    if (!taskId) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not logged in");

    const position =
      subtasks.reduce((max, s) => Math.max(max, s.position), 0) + 1;
    const { data, error } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        user_id: session.user.id,
        title,
        position,
        ai_generated: false,
      })
      .select()
      .single();
    if (error) throw error;
    setSubtasks((prev) => [...prev, data]);
  };

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.subtask_id === subtaskId ? { ...s, completed } : s))
    );
    const { error } = await supabase
      .from("subtasks")
      .update({ completed })
      .eq("subtask_id", subtaskId);
    if (error) {
      await fetchSubtasks();
      throw error;
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    const { error } = await supabase
      .from("subtasks")
      .delete()
      .eq("subtask_id", subtaskId);
    if (error) throw error;
    setSubtasks((prev) => prev.filter((s) => s.subtask_id !== subtaskId));
  };

  // Ask OpenAI (through the generate-subtasks Edge Function) for steps.
  const generateSubtasks = async () => {
    if (!taskId) return;
    setIsGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ task_id: taskId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Failed to generate steps");
      }
      setSubtasks((prev) => [...prev, ...(body as Subtask[])]);
      return (body as Subtask[]).length;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    subtasks,
    isLoading,
    isGenerating,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    generateSubtasks,
  };
}
