/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from "node-fetch";
import { LocalStorage, preferences } from "@raycast/api";
import { Project, Task, TaskTimerResp, TaskStopTimerResp, TaskResp, CurrentTimerResp, TimeRecordResp } from "../types";

const API_KEY = preferences.token.value as string;

const headers = {
  "X-Api-Key": API_KEY,
  "Content-Type": "application/json",
};

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

export const getCurrentUser = async () => {
  const response = await fetch("https://api.everhour.com/users/me", {
    headers,
  });

  return (await response.json()) as any;
};

export const getRecentTasks = async (callback?: (tasks: Task[]) => void, userId = "me"): Promise<Task[]> => {
  const [currentDate] = daysAgo(7).toISOString().split("T");
  const response = fetch(`https://api.everhour.com/users/${userId}/time?limit=1000&from=${currentDate}`, {
    headers,
  });

  if (callback) {
    const fromStorage = await LocalStorage.getItem<string>("recentTasks");
    if (fromStorage && fromStorage.length > 0) {
      callback(JSON.parse(fromStorage));
    }
  }

  const timeRecords = (await (await response).json()) as TimeRecordResp[];

  if ("code" in timeRecords || timeRecords.length == 0) {
    throw new Error("No recent tasks.");
  }

  const tasks = Object.values(
    timeRecords.reduce((agg: { [key: string]: Task }, { time, task }: TimeRecordResp) => {
      if (agg[task.id] === undefined) {
        agg[task.id] = {
          id: task.id,
          name: task.name,
          projects: task.projects,
          time: { total: task.time.total || 0, recent: time },
        };
      } else {
        agg[task.id].time.recent += time;
      }
      return agg;
    }, {})
  );

  LocalStorage.setItem("recentTasks", JSON.stringify(tasks));
  return tasks;
};

export const getProjects = async (callback?: (projects: Project[]) => void, query?: string): Promise<Project[]> => {
  const response = fetch(`https://api.everhour.com/projects?limit=10&query=${query}`, {
    headers,
  });

  if (!query && callback) {
    const fromStorage = await LocalStorage.getItem<string>("projects");
    if (fromStorage && fromStorage.length > 0) {
      callback(JSON.parse(fromStorage));
    }
  }

  const projectsResp = (await (await response).json()) as any;

  if (projectsResp.code) {
    throw new Error(projectsResp.message);
  }

  const projects = projectsResp.map(({ id, name }: Project) => ({
    id,
    name,
  }));

  if (!query) {
    LocalStorage.setItem("projects", JSON.stringify(projects));
  }
  return projects;
};

export const getTasks = async (projectId: string): Promise<Task[]> => {
  const response = await fetch(
    `https://api.everhour.com/projects/${projectId}/tasks?page=1&limit=250&excludeClosed=true&query=`,
    {
      headers,
    }
  );
  const tasks = (await response.json()) as any;

  if (tasks.code) {
    throw new Error(tasks.message);
  }

  return tasks.map(({ id, name }: TaskResp) => ({ id, name }));
};

export const getCurrentTimer = async (callback?: (taskId: string) => void): Promise<string | null> => {
  const response = fetch("https://api.everhour.com/timers/current", {
    headers,
  });

  if (callback) {
    const fromStorage = await LocalStorage.getItem<string>("currentTimer");
    if (fromStorage && fromStorage.length > 0) {
      callback(fromStorage);
    }
  }

  const currentTimer = (await (await response).json()) as CurrentTimerResp;

  if (currentTimer.status === "stopped") {
    await LocalStorage.removeItem("currentTimer");
    return null;
  }

  await LocalStorage.setItem("currentTimer", currentTimer.task.id);
  return currentTimer.task.id;
};

export const startTaskTimer = async (taskId: string): Promise<{ status: string; taskName: string }> => {
  const response = await fetch("https://api.everhour.com/timers", {
    method: "POST",
    headers,
    body: JSON.stringify({
      task: taskId,
    }),
  });
  const respJson = (await response.json()) as TaskTimerResp;

  await LocalStorage.setItem("currentTimer", taskId);
  return {
    status: respJson.status,
    taskName: respJson.task.name,
  };
};

export const stopCurrentTaskTimer = async (): Promise<{ status: string; taskName: string }> => {
  const response = await fetch("https://api.everhour.com/timers/current", {
    method: "DELETE",
    headers,
  });
  const respJson = (await response.json()) as TaskStopTimerResp;

  await LocalStorage.removeItem("currentTimer");
  return {
    status: respJson.status,
    taskName: respJson.taskTime?.task?.name,
  };
};

export const submitTaskHours = async (taskId: string, hours: string): Promise<{ taskName: string }> => {
  const seconds = parseFloat(hours) * 60 * 60;

  const response = await fetch(`https://api.everhour.com/tasks/${taskId}/time`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      time: seconds,
      date: new Date().toISOString().split("T")[0],
    }),
  });
  const respJson = (await response.json()) as TaskTimerResp;

  return {
    taskName: respJson.task?.name,
  };
};
