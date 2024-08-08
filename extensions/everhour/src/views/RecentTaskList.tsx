import { useState, useEffect } from "react";
import { List, Icon, showToast, ToastStyle } from "@raycast/api";
import { TaskListItem } from "../components";
import { getRecentTasks, getCurrentTimer } from "../api";
import { Task } from "../types";
import { createResolvedToast } from "../utils";

export function RecentTaskList() {
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<null | string>(null);
  const [tasks, setTasks] = useState<Array<Task>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshActiveTimer = async (expectedActiveTimerTaskId: string | null = null) => {
    if (expectedActiveTimerTaskId !== null) {
      setActiveTimerTaskId(expectedActiveTimerTaskId);
    } else {
      const toast = await showToast(ToastStyle.Animated, "Refreshing timer");
      try {
        const activeTimer = await getCurrentTimer();
        setActiveTimerTaskId(activeTimer);
        createResolvedToast(toast, "Timer refreshed").success();
      } catch (error) {
        createResolvedToast(toast, "Failed to refresh timer").error();
      }
    }
  };

  const fetchTasks = async () => {
    const tasksResp = await getRecentTasks(setTasks);
    setTasks(tasksResp);
  };

  useEffect(() => {
    async function fetch() {
      const toast = await showToast(ToastStyle.Animated, "Fetching tasks");
      try {
        const tasksProm = fetchTasks();
        const activeTimer = await getCurrentTimer(setActiveTimerTaskId);
        setActiveTimerTaskId(activeTimer);
        await tasksProm;
        setIsLoading(false);
        createResolvedToast(toast, "Tasks fetched").success();
      } catch (error) {
        const message = (error as { message: string }).message;
        createResolvedToast(toast, message || "Failed to fetch tasks").error();
        setIsLoading(false);
      }
    }
    fetch();
  }, []);

  const renderTasks = () => {
    if (tasks[0]) {
      return tasks
        .sort((t1, t2) => {
          // Active timer first.
          if (t1.id === activeTimerTaskId) return -1;
          if (t2.id === activeTimerTaskId) return 1;
          // Keep order otherwise.
          return 0;
          // Sort times descending by time.
          // return t1.time.recent > t2.time.recent ? -1 : 1;
        })
        .map((task) => (
          <TaskListItem
            key={task.id}
            refreshRecords={getRecentTasks}
            refreshActiveTimer={refreshActiveTimer}
            task={task}
            hasActiveTimer={task.id === activeTimerTaskId}
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
