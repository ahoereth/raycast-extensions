import { useCachedPromise } from "@raycast/utils";

import { getIssues } from "./api/issues";
import StatusIssueList from "./components/StatusIssueList";
import { withJiraCredentials } from "./helpers/withJiraCredentials";

export function ReportedIssues() {
  const {
    data: issues,
    isLoading,
    mutate,
  } = useCachedPromise(() => getIssues({ jql: "reporter = currentUser() ORDER BY updated DESC" }));

  return <StatusIssueList issues={issues} isLoading={isLoading} mutate={mutate} />;
}

export default function Command() {
  return withJiraCredentials(<ReportedIssues />);
}
