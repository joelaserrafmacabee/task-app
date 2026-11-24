"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Sparkles, Trash2, Loader2 } from "lucide-react";
import { useSubtasks } from "@/hooks/useSubtasks";
import { useToast } from "@/components/hooks/use-toast";
import { cn } from "@/lib/utils";

// The "Steps" section on the task page: a checklist of subtasks, with a
// progress bar, a box to add a step by hand, and a button that asks OpenAI
// to break the task into steps.
export default function SubtaskSection({ taskId }: { taskId: string }) {
  const {
    subtasks,
    isLoading,
    isGenerating,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    generateSubtasks,
  } = useSubtasks(taskId);
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");

  const done = subtasks.filter((s) => s.completed).length;
  const percent = subtasks.length
    ? Math.round((done / subtasks.length) * 100)
    : 0;

  const showError = (title: string, error: any) =>
    toast({
      title: `❌ ${title}`,
      description: error?.message || "Something went wrong",
      variant: "destructive",
    });

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await addSubtask(title);
      setNewTitle("");
    } catch (error) {
      showError("Could not add step", error);
    }
  };

  const handleGenerate = async () => {
    try {
      const count = await generateSubtasks();
      toast({
        title: "✨ Steps added",
        description: `The AI added ${count} steps to this task.`,
      });
    } catch (error) {
      showError("AI could not create steps", error);
    }
  };

  return (
    <section
      aria-label="Steps"
      className="mt-10 rounded-lg border p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Steps</h2>
          <p className="text-sm text-muted-foreground">
            Break this task into smaller steps and check them off.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isGenerating ? "Thinking..." : "Break down with AI"}
        </Button>
      </div>

      {subtasks.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {done} of {subtasks.length} done
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading steps...</p>
      ) : subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No steps yet. Add one below, or let the AI suggest some.
        </p>
      ) : (
        <ul className="space-y-2">
          {subtasks.map((s) => (
            <li
              key={s.subtask_id}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <Checkbox
                id={`subtask-${s.subtask_id}`}
                checked={s.completed}
                onCheckedChange={(checked) =>
                  toggleSubtask(s.subtask_id, checked === true).catch((e) =>
                    showError("Could not update step", e)
                  )
                }
              />
              <Label
                htmlFor={`subtask-${s.subtask_id}`}
                className={cn(
                  "flex-1 font-normal cursor-pointer",
                  s.completed && "line-through text-muted-foreground"
                )}
              >
                {s.title}
              </Label>
              {s.ai_generated && (
                <span
                  title="Suggested by AI"
                  className="flex items-center text-xs text-muted-foreground"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Delete step"
                onClick={() =>
                  deleteSubtask(s.subtask_id).catch((e) =>
                    showError("Could not delete step", e)
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Add a step..."
          value={newTitle}
          maxLength={200}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
    </section>
  );
}
