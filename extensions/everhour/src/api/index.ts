/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from "node-fetch";
import { LocalStorage, preferences } from "@raycast/api";
import {
  User,
  Project,
  Task,
  TaskTimerResp,
  TaskStopTimerResp,
  TaskResp,
  CurrentTimerResp,
  TimeRecordResp,
} from "../types";

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

const taskFromTaskResp = (task: TaskResp, userId?: string, recentTime = 0) => ({
  id: task.id,
  name: task.name,
  number: task.number,
  url: task.url,
  projects: task.projects,
  time: { total: task.time?.total || 0, user: task.time?.users[userId] || 0, recent: recentTime },
});

export const getCurrentUser = async (): Promise<User> => {
  const response = await fetch("https://api.everhour.com/users/me", {
    headers,
  });

  return (await response.json()) as User;
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

  if ("code" in timeRecords || timeRecords.length === 0) {
    throw new Error("No recent tasks.");
  }

  if (userId === "me") {
    userId = timeRecords[0].user;
  }

  const aggregatedTasks = timeRecords.reduce((agg: { [key: string]: Task }, { time, task: { id } }: TimeRecordResp) => {
    if (!agg[id]) {
      agg[id] = taskFromTaskResp(task, userId, time);
    } else {
      agg[id].time.recent += time;
    }
    return agg;
  }, {});

  const aggregatedTaskList = Object.values(aggregatedTasks);

  LocalStorage.setItem("recentTasks", JSON.stringify(aggregatedTaskList));
  return aggregatedTaskList;
};

export const getProjects = async (callback?: (projects: Project[]) => void, query?: string): Promise<Project[]> => {
  const response = fetch(`https://api.everhour.com/projects?limit=1000&query=${query || ""}`, {
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

export const getProjectTasks = async (
  projectId: string,
  limit = 20,
  query?: string,
  userId?: string
): Promise<Task[]> => {
  const url = query
    ? `https://api.everhour.com/projects/${projectId}/tasks/search?page=1&limit=${limit}&searchInClosed=false&query=recurrent`
    : `https://api.everhour.com/projects/${projectId}/tasks?page=1&limit=${limit}&excludeClosed=true&query=`;
  const response = await fetch(url, { headers });
  const tasks = (await response.json()) as any;

  if (tasks.code) {
    throw new Error(tasks.message);
  }

  return tasks.map((task) => taskFromTaskResp(task, userId));
};

export const searchTasks = async (query: string, userId?: string, limit = 20): Promise<Task[]> => {
  const response = await fetch(
    `https://api.everhour.com/tasks/search?page=1&limit=${limit}&searchInClosed=false&query=${query}`,
    { headers }
  );
  const tasks = (await response.json()) as any;

  if (tasks.code) {
    throw new Error(tasks.message);
  }

  return tasks.map((task) => taskFromTaskResp(task, userId));
};

export const getCurrentTask = async (callback?: (taskId: string) => void): Promise<Task | null> => {
  const response = fetch("https://api.everhour.com/timers/current", {
    headers,
  });

  if (callback) {
    const fromStorage = await LocalStorage.getItem<string>("currentTask");
    if (fromStorage && fromStorage.length > 0) {
      callback(JSON.parse(fromStorage));
    }
  }

  const currentTimer = (await (await response).json()) as CurrentTimerResp;

  if (currentTimer.status === "stopped") {
    await LocalStorage.removeItem("currentTask");
    return null;
  }

  await LocalStorage.setItem("currentTask", JSON.stringify(currentTimer.task));
  return taskFromTaskResp(currentTimer.task);
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

export const submitTaskHours = async (taskId: string, date: Date, seconds: number): Promise<{ taskName: string }> => {
  const response = await fetch(`https://api.everhour.com/tasks/${taskId}/time`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      time: seconds,
      date: date.toISOString().split("T")[0],
    }),
  });
  const respJson = (await response.json()) as TaskTimerResp;
  return taskFromTaskResp(respJson.task);
};
