import { ToastStyle, Toast } from "@raycast/api";
import { Task } from "../types";

export const createResolvedToast = (
  toast: Toast,
  title: string,
  message?: string
): { error: () => void; success: () => void } => {
  toast.title = title;
  toast.message = message;
  const error = (): void => {
    toast.style = ToastStyle.Failure;
  };

  const success = (): void => {
    toast.style = ToastStyle.Success;
  };

  return { error, success };
};

export const filterTasks = (records: Task[], projectId: string | string[]) => {
  if (!Array.isArray(projectId)) {
    projectId = [projectId];
  }
  return records.filter((record: Task) => -1 !== projectId.indexOf(record.projects[0]));
};

export const formatSeconds = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const min = minutes % 60;
    return `${hours}h ${min}m`;
  }
  return `${minutes}m`;
};
