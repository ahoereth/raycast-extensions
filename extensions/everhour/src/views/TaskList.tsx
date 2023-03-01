import { useState, useEffect } from "react";
import { List, Icon, showToast, ToastStyle } from "@raycast/api";
import { TaskListItem } from "../components";
import { getCurrentTask, getProjectTasks } from "../api";
import { createResolvedToast, filterTasks } from "../utils";
import { Task } from "../types";

export function TaskList({
  projectId,
  timeRecords,
  refreshRecords,
}: {
  projectId: string;
  timeRecords?: Array<Task>;
  refreshRecords: () => Promise<Array<Task>>;
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Array<Task>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshActiveTask = async () => {
    const toast = await showToast(ToastStyle.Animated, "Refreshing tasks");
    try {
      const activeTask = await getCurrentTask();
      setActiveTask(activeTask);
      createResolvedToast(toast, "Tasks refreshed").success();
    } catch (error) {
      createResolvedToast(toast, "Failed to refresh tasks").error();
    }
  };

  const fetchTasks = async () => {
    const tasksResp = await getProjectTasks(projectId);

    setTasks(tasksResp);
  };

  useEffect(() => {
    async function fetch() {
      const toast = await showToast(ToastStyle.Animated, "Fetching tasks");
      try {
        await fetchTasks();
        setIsLoading(false);
        createResolvedToast(toast, "Tasks fetched").success();
      } catch (error) {
        const message = (error as { message: string }).message;
        createResolvedToast(toast, message || "Failed to fetch projects").error();
        setIsLoading(false);
      }
    }
    fetch();
  }, []);

  useEffect(() => {
    refreshActiveTask();
  }, [activeTask]);

  const recentTimeRecords = timeRecords ? filterTasks(timeRecords, projectId) : [];

  const renderTasks = () => {
    if (tasks[0]) {
      return tasks.map((task) => (
        <TaskListItem
          key={task.id}
          recentTimeRecords={recentTimeRecords}
          refreshRecords={() => {
            fetchTasks();
            return refreshRecords();
          }}
          refreshActiveTask={refreshActiveTask}
          task={task}
          hasActiveTimer={task.id === activeTask?.id}
        />
      ));
    }

    if (!isLoading && tasks[0]) {
      return <List.Item title="No tasks found" icon={Icon.XmarkCircle} />;
    }
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter tasks by name...">
      {renderTasks()}
    </List>
  );
}
