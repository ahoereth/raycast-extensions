import React, { useState } from "react";
import { List, ActionPanel, Action, PushAction, Icon, Color, showToast, ToastStyle } from "@raycast/api";
import { TimeSubmitForm } from "../views";
import { Task } from "../types";
import { startTaskTimer, stopCurrentTaskTimer } from "../api";
import { createResolvedToast, formatSeconds } from "../utils";

export function TaskListItem({
  task,
  hasActiveTimer,
  refreshActiveTask,
  refreshRecords,
  recentTimeRecords = [],
}: {
  task: Task;
  hasActiveTimer: boolean;
  refreshActiveTask: (task?: Task | null) => Promise<void>;
  refreshRecords: () => Promise<Array<Task>>;
  recentTimeRecords?: Array<Task>;
}) {
  const [timeRecords, setTimeRecords] = useState<Array<Task>>(recentTimeRecords);

  const enableTaskTimer = async () => {
    refreshActiveTask(task);
    const toast = await showToast(ToastStyle.Animated, "Starting timer");
    try {
      const { taskName } = await startTaskTimer(task.id);
      createResolvedToast(toast, "Timer started for " + taskName).success();
    } catch (error) {
      createResolvedToast(toast, "Error starting timer").error();
    }
  };
  const disableActiveTimer = async () => {
    refreshActiveTask();
    const toast = await showToast(ToastStyle.Animated, "Stopping timer");
    try {
      const { taskName } = await stopCurrentTaskTimer();
      refreshActiveTask();

      if (taskName) {
        createResolvedToast(toast, "Timer stopped for " + taskName).success();
      } else {
        createResolvedToast(toast, "No active timer").error();
      }
    } catch (error) {
      createResolvedToast(toast, "Error stopping timer").error();
    }
  };

  const resolveTaskTime = (): string => {
    const record = timeRecords?.find((timeRecord) => timeRecord.id === task.id);
    let user = 0;
    let recent = 0;
    if (record && record.time.user > 0) {
      user = record.time.user;
      recent = record.time.recent || 0;
    }
    if (task.time.user > 0) {
      user = task.time.user || 0;
      recent = task.time.recent;
    }
    if (recent) return `${formatSeconds(recent)} recently`;
    if (user) return formatSeconds(user);
    return "";
  };

  const buildSubtitle = () => {
    const time = resolveTaskTime();
    if (task.number && time) return `${task.number}   ${time}`;
    if (task.number) return task.number;
    return time;
  };

  return (
    <List.Item
      id={task.id}
      key={task.id}
      title={task.name}
      subtitle={buildSubtitle()}
      icon={{ source: Icon.Dot, tintColor: hasActiveTimer ? Color.Green : Color.SecondaryText }}
      actions={
        <ActionPanel>
          {hasActiveTimer ? (
            <ActionPanel.Item title="Stop Active Timer" onAction={disableActiveTimer} />
          ) : (
            <ActionPanel.Item title="Start Timer" onAction={enableTaskTimer} />
          )}
          <PushAction
            title="Submit Custom Time"
            target={
              <TimeSubmitForm
                taskId={task.id}
                refreshRecords={async () => {
                  const records = await refreshRecords();
                  setTimeRecords(records);
                }}
              />
            }
          />
          {task.url || task.number ? (
            <ActionPanel.Section title="Ticket">
              {task.url ? <Action.OpenInBrowser url={task.url} /> : ""}
              {task.number ? <Action.CopyToClipboard title="Copy ticket number" content={task.number} /> : ""}
            </ActionPanel.Section>
          ) : (
            ""
          )}
        </ActionPanel>
      }
    />
  );
}
