import { Form, Action, ActionPanel, SubmitFormAction, showToast, ToastStyle } from "@raycast/api";
import { submitTaskHours } from "../api";
import { createResolvedToast, formatSeconds } from "../utils";
import { Task } from "../types";

const timeOptions = [
  { title: "15 min", value: "0.25" },
  { title: "30 min", value: "0.5" },
  { title: "45 min", value: "0.75" },
  { title: "1 hour", value: "1" },
  { title: "1 hour 30 min", value: "1.5" },
  { title: "2 hour", value: "2" },
  { title: "2 hour 30 min", value: "2.5" },
  { title: "3 hour", value: "3" },
  { title: "3 hour 30 min", value: "3.5" },
  { title: "4 hour", value: "4" },
  { title: "4 hour 30 min", value: "4.5" },
  { title: "5 hour", value: "5" },
  { title: "5 hour 30 min", value: "5.5" },
  { title: "6 hour", value: "6" },
  { title: "6 hour 30 min", value: "6.5" },
  { title: "7 hour", value: "7" },
  { title: "7 hour 30 min", value: "7.5" },
];

export function TimeSubmitForm({ task, refreshRecords }: { task: Task; refreshRecords: () => Promise<void> }) {
  const { id: taskId, name, number, url, time } = task;

  const handleSubmit = async ({ hours, date }: { date: Date; hours: string }) => {
    const seconds = parseFloat(hours) * 60 * 60;
    const toast = await showToast(ToastStyle.Animated, "Adding Time");
    try {
      const { name } = await submitTaskHours(taskId, date, seconds);
      if (name) {
        await refreshRecords();
        createResolvedToast(toast, `Added ${formatSeconds(seconds)} to ${name}`).success();
      } else {
        createResolvedToast(toast, "Failed to add time").error();
      }
    } catch (error) {
      console.log(error);
      createResolvedToast(toast, "Failed to add time").error();
    }
  };

  // {hasActiveTimer ? (
  //   <ActionPanel.Item title="Stop Active Timer" onAction={disableActiveTimer} />
  // ) : (
  //   <ActionPanel.Item title="Start Timer" onAction={enableTaskTimer} />
  // )}
  return (
    <Form
      navigationTitle={name}
      actions={
        <ActionPanel>
          <SubmitFormAction title="Add Time" onSubmit={handleSubmit} />
          <Action.OpenInBrowser title="Open in Everhour" url={`https://app.everhour.com/#/time(view:${taskId})`} />
          {url ? <Action.OpenInBrowser title="Open in Browser" url={url} /> : ""}
          {number ? <Action.CopyToClipboard title="Copy ticket number" content={number} /> : ""}
        </ActionPanel>
      }
    >
      <Form.Description title="Task" text={name} />
      <Form.Description title="Number" text={number} />
      <Form.Description title="URL" text={url} />
      <Form.Description title="Time Total" text={formatSeconds(time.total)} />
      <Form.Description title="Your Time" text={formatSeconds(time.user)} />
      <Form.Description title="Your Recent Time" text={formatSeconds(time.recent)} />
      <Form.Dropdown id="hours" title="Add Time" defaultValue="0.25">
        {timeOptions.map(({ value, title }) => (
          <Form.Dropdown.Item key={value} value={value} title={title} icon="⏱" />
        ))}
      </Form.Dropdown>
      <Form.DatePicker id="date" title="Date to add time" type={Form.DatePicker.Type.Date} defaultValue={new Date()} />
    </Form>
  );
}
