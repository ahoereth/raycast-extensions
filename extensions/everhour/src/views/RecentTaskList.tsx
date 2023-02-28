import { useState, useEffect } from "react";
import { List, Icon, showToast, ToastStyle, LaunchProps } from "@raycast/api";
import { TaskListItem } from "../components";
import { getRecentTasks, getCurrentTimer, getProjects, getProjectTasks } from "../api";
import { Task, Project } from "../types";
import { createResolvedToast } from "../utils";

interface TaskListArguments {
  projectQuery: string;
}

function ProjectDropdown(props: {
  projectQuery: string;
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { projectQuery, projects, value, onChange } = props;
  const defaultItemTitle = projectQuery ? `Query: ${projectQuery}` : "All projects";
  return (
    <List.Dropdown
      tooltip="Select project"
      storeValue={true}
      defaultValue={value}
      onChange={(value) => {
        console.log("onChange", value);
        onChange(value);
      }}
    >
      <List.Dropdown.Item title={defaultItemTitle} value="_all" key="_all" />
      {projects.map(({ id, name }) => (
        <List.Dropdown.Item title={name} value={id} key={id} />
      ))}
    </List.Dropdown>
  );
}

export function RecentTaskList(props: LaunchProps<{ arguments: TaskListArguments }>) {
  const { projectQuery } = props.arguments;

  const [project, setProject] = useState<string>("_all");
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<null | string>(null);
  const [tasks, setTasks] = useState<Array<Task>>([]);
  const [projects, setProjects] = useState<Array<Project>>([]);
  const [timeRecords, setTimeRecords] = useState<Array<Task>>([]);
  const [query, setQuery] = useState<string>("");
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

  useEffect(() => {
    let cancel = false;
    async function fetch(query: string) {
      const toast = await showToast(ToastStyle.Animated, "Fetching tasks");
      try {
        console.log("collect", projectQuery, query, project);
        if (projectQuery && project === "_all" && projects.length) {
          const results = await Promise.all(projects.slice(0, 2).map(({ id }) => getProjectTasks(id)));
          setTasks([].concat(...results));
        } else if (project && project !== "_all") {
        } else if (!query && !project) {
          const tasksResp = await getRecentTasks(setTasks);
          setTasks(tasksResp);
        }

        if (!cancel) {
          setIsLoading(false);
          createResolvedToast(toast, "Tasks fetched").success();
        }
      } catch (error) {
        const message = (error as { message: string }).message;
        createResolvedToast(toast, message || "Failed to fetch tasks").error();
        setIsLoading(false);
      }
    }
    const timeout = setTimeout(() => {
      fetch(query);
    }, 200);
    return () => {
      cancel = true;
      clearTimeout(timeout);
    };
  }, [query, project, projects]);

  useEffect(() => {
    const fetch = async () => {
      console.log("query", projectQuery);
      const projectsProm = getProjects(setProjects, projectQuery);
      const tasksProm = getRecentTasks(setTasks);
      setActiveTimerTaskId(await getCurrentTimer(setActiveTimerTaskId));
      setProjects(await projectsProm);
      setTimeRecords(await tasksProm);
    };
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
            recentTimeRecords={timeRecords}
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
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter tasks by name..."
      filtering={true}
      onSearchTextChange={setQuery}
      searchBarAccessory={
        <ProjectDropdown projects={projects} value={projectQuery} onChange={setProject} projectQuery={projectQuery} />
      }
    >
      {renderTasks()}
    </List>
  );
}
