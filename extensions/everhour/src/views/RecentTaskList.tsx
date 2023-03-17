import { useState, useEffect } from "react";
import { List, Icon, showToast, ToastStyle, LaunchProps } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { TaskListItem } from "../components";
import { getRecentTasks, getCurrentUser, getCurrentTask, getProjects, getProjectTasks, searchTasks } from "../api";
import { User, Task, Project } from "../types";
import { createResolvedToast, filterTasks } from "../utils";

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
  const defaultItemTitle = projectQuery ? `Project Query: ${projectQuery}` : "All projects";
  return (
    <List.Dropdown tooltip="Select project" storeValue={true} defaultValue={value} onChange={onChange}>
      <List.Dropdown.Section>
        <List.Dropdown.Item title={defaultItemTitle} value="_all" key="_all" />
      </List.Dropdown.Section>
      {projects.map(({ id, name }) => (
        <List.Dropdown.Item title={name} value={id} key={id} />
      ))}
    </List.Dropdown>
  );
}

const joinTasks = (a: Task[], b: null | Task | Task[]) => {
  if (!b) return a;
  if (!Array.isArray(b)) {
    b = [b];
  }
  const ids = a.map(({ id }) => id);
  return b.reduce(
    (agg, task) => {
      if (task && -1 === ids.findIndex((id) => id === task.id)) {
        agg.push(task);
      }
      return agg;
    },
    [...a]
  );
};

const addStickyTasks = (tasks: Task[], sticky: Task[], project?: string | string[]) => {
  const stickyTasks = project ? [...filterTasks(sticky, project)] : sticky;
  return joinTasks(tasks, sticky);
};

export function RecentTaskList(props: LaunchProps<{ arguments: TaskListArguments }>) {
  const { projectQuery } = props.arguments;

  const [user, setUser] = useCachedState<User | null>("user", null);
  const [activeTask, setActiveTask] = useCachedState<Task | null>("activeTask", null);
  const [recentTasks, setRecentTasks] = useCachedState<Task[]>("recentTasks", []);
  const [timeRecords, setTimeRecords] = useCachedState<{ [key: string]: number }>("timeRecords", {});

  const [project, setProject] = useState<string>("_all");
  const [tasks, setTasks] = useState<Array<Task>>([]);
  const [projects, setProjects] = useState<Array<Project>>([]);
  const [query, setQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshActiveTask = async (expectedActiveTask: Task | null = null) => {
    if (expectedActiveTask !== null) {
      setActiveTask(expectedActiveTask);
    } else {
      const toast = await showToast(ToastStyle.Animated, "Refreshing timer");
      try {
        const activeTask = await getCurrentTask();
        setActiveTask(activeTask);
        createResolvedToast(toast, "Timer refreshed").success();
      } catch (error) {
        createResolvedToast(toast, "Failed to refresh timer").error();
      }
    }
  };

  useEffect(() => {
    let cancel = false;
    const fetch = async (query: string) => {
      setIsLoading(true);
      const toast = await showToast(ToastStyle.Animated, "Fetching tasks");
      try {
    console.log("collect", `'${projectQuery}'`, `'${query}'`, project, user?.id, projects.length);
        let result: Task[] = [];
        if (user && projectQuery && project === "_all" && projects.length) {
          const results = await Promise.all(
            projects.slice(0, 10).map(({ id }) => getProjectTasks(id, 10, query, user.id))
          );
          result = ([] as Task[]).concat(...results);
        } else if (user && project && project !== "_all") {
          result = await getProjectTasks(project, 20, query, user.id);
        } else if (user && query) {
          result = await searchTasks(query, user.id, 20);
        } else {
          result = await getRecentTasks();
        }

        const relevant = joinTasks(recentTasks, activeTask);
        const sticky = relevant.filter(({ name }) => {
          return name.toLowerCase().indexOf(query) !== -1;
        });
        for (let task of result) {
          if (timeRecords[task.id]) {
            task.time.recent = timeRecords[task.id];
          }
        }
        if (!cancel) {
          setTasks(addStickyTasks(result, sticky, project));
        }

        createResolvedToast(toast, "Tasks fetched").success();
        setIsLoading(false);
      } catch (error) {
        const message = (error as { message: string }).message;
        createResolvedToast(toast, message || "Failed to fetch tasks").error();
        setIsLoading(false);
      }
    };


    const timeout = setTimeout(() => {
      fetch(query);
    }, 200);
    return () => {
      cancel = true;
      clearTimeout(timeout);
    };
  }, [query, project, user]);

  useEffect(() => {
    const lookup = recentTasks.reduce((agg, { id, time }) => {
      agg[id] = time.recent;
      return agg;
    }, {} as { [key: string]: number });
    setTimeRecords(lookup);
    if (activeTask) {
      setTasks(addStickyTasks([activeTask], recentTasks));
    } else {
      setTasks(recentTasks);
    }
  }, [recentTasks, activeTask]);

  useEffect(() => {
    const fetch = async () => {
      const tasksProm = getRecentTasks(setRecentTasks);
      const projectsProm = getProjects(setProjects, projectQuery);
      const userProm = getCurrentUser();
      const activeProm = getCurrentTask(setActiveTask);
      setProjects(await projectsProm);
      setRecentTasks(await tasksProm);
      setUser(await userProm);
      setActiveTask(await activeProm);
    };
    fetch();
  }, []);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter tasks by name..."
      filtering={false}
      onSearchTextChange={(value) => setQuery(value.toLowerCase())}
      searchBarAccessory={
        <ProjectDropdown projects={projects} value={projectQuery} onChange={setProject} projectQuery={projectQuery} />
      }
    >
      {tasks[0]
        ? tasks
            .sort((t1, t2) => {
              // Active timer first.
              if (t1.id === activeTask?.id) return -1;
              if (t2.id === activeTask?.id) return 1;
              // Sort times descending by time.
              const diff = t2.time.recent - t1.time.recent;
              if (diff !== 0) return diff;
              return t2.time.user - t1.time.user;
            })
            .map((task) => (
              <TaskListItem
                key={task.id}
                refreshRecords={getRecentTasks}
                refreshActiveTask={refreshActiveTask}
                task={task}
                hasActiveTimer={task.id === activeTask?.id}
              />
            ))
        : ""}

      {!isLoading && !tasks[0] ? <List.Item title="No tasks found" icon={Icon.XmarkCircle} /> : ""}
    </List>
  );
}
