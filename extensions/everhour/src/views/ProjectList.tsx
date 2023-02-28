import { useState, useEffect } from "react";
import { List, Icon, showToast, ToastStyle } from "@raycast/api";
import { ProjectListItem } from "../components";
import { getProjects, getRecentTasks } from "../api";
import { Project, Task } from "../types";
import { createResolvedToast } from "../utils";

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [timeRecords, setTimeRecords] = useState<Array<Task>>([]);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    async function fetch(query: string) {
      setIsLoading(true);
      const toast = await showToast(ToastStyle.Animated, "Querying projects");
      const projectsResp = await getProjects(() => {
        /*noop*/
      }, query);
      if (projectsResp.length > 0) {
        setProjects(projectsResp);
      }
      createResolvedToast(toast, "Projects queried").success();
      setIsLoading(false);
    }
    if (query) {
      const timer = setTimeout(() => fetch(query), 200);
      return () => clearTimeout(timer);
    }
  }, [query]);

  useEffect(() => {
    let cancel = false;
    const fetch = async () => {
      const toast = await showToast(ToastStyle.Animated, "Fetching projects");
      try {
        const projectsResp = await getProjects(setProjects);
        const records = await getRecentTasks(setTimeRecords);
        setTimeRecords(records);

        if (!cancel) {
          setProjects(projectsResp);
          setIsLoading(false);
        }
        createResolvedToast(toast, "Projects fetched").success();
        return projectsResp;
      } catch (error) {
        const message = (error as { message: string }).message || "";
        createResolvedToast(toast, "Failed to fetch projects", message).error();
        setIsLoading(false);
      }
    };
    if (query === "") fetch();
    return () => {
      cancel = true;
    };
  }, [query]);

  const renderProjects = () => {
    if (projects[0]) {
      return projects.map((project) => (
        <ProjectListItem timeRecords={timeRecords} refreshRecords={getRecentTasks} key={project.id} project={project} />
      ));
    }

    if (!isLoading && !projects[0]) {
      return <List.Item title="No projects found" icon={Icon.XmarkCircle} />;
    }
  };

  return (
    <List
      isLoading={isLoading}
      filtering={true}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Filter projects by name..."
    >
      {renderProjects()}
    </List>
  );
}
