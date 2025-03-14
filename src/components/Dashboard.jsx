import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Users, MessageSquare, FolderKanban, FileText } from "lucide-react";
import _ from "lodash";

import MetricCard from "./shared/MetricCard";
import SortableTable from "./shared/SortableTable";

// No longer need project name helper functions since we'll use the name field directly

const Dashboard = ({ fileData }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!fileData) {
      setIsLoading(false);
      return;
    }

    const processData = () => {
      try {
        // Extract user data from users.json
        const userDataFromFile = fileData.filter(
          (item) => item.source === "users.json"
        );
        console.log("User data from users.json:", userDataFromFile.length);

        // Create a map of user information from users.json
        const userMap = {};
        const userUuidMap = {};

        // First, process users.json to get definitive user information
        userDataFromFile.forEach((userData) => {
          // For the specific format provided by the user:
          // {"uuid": "...", "full_name": "...", "email_address": "...", "verified_phone_number": "..."}

          // Use email_address as the key (already mapped in FileUpload component)
          const email = userData.email_address || userData.email || "Unknown";
          const name =
            userData.full_name ||
            userData.name ||
            userData.userName ||
            "Unknown User";
          const uuid = userData.uuid || "";

          if (email && email !== "Unknown") {
            userMap[email] = {
              uuid: uuid,
              name: name,
              email: email,
              phone: userData.verified_phone_number || "",
              totalActions: 0,
              conversations: 0,
              projects: 0,
              files: 0,
              lastSeen: userData.date,
            };
          }

          // Also store by UUID for linking conversations
          if (uuid) {
            userUuidMap[uuid] = {
              uuid: uuid,
              name: name,
              email: email,
              phone: userData.verified_phone_number || "",
              totalActions: 0,
              conversations: 0,
              projects: 0,
              files: 0,
              lastSeen: userData.date,
            };
          }
        });

        console.log(
          "Extracted users from users.json:",
          Object.keys(userMap).length
        );
        console.log("Users with UUIDs:", Object.keys(userUuidMap).length);

        // Check for event types in the data
        const hasConversationData = fileData.some(
          (item) =>
            item.event === "conversation_created" ||
            item.source === "conversations.json"
        );

        const hasProjectData = fileData.some(
          (item) =>
            item.event === "project_created" || item.source === "projects.json"
        );

        const hasUserData = userDataFromFile.length > 0;

        // Process activity data and associate with users
        fileData.forEach((row) => {
          // Skip user.json entries when counting activities
          if (row.source === "users.json") return;

          // Determine row type based on source file or event type
          const isConversation =
            row.event === "conversation_created" ||
            row.source === "conversations.json";
          const isProject =
            row.event === "project_created" || row.source === "projects.json";
          const isFileUpload = row.event === "file_uploaded";

          // Get user email or UUID for matching
          let email = row.email_address || row.email || "";
          let userName = row.full_name || row.userName || row.name || "";
          let userUuid = row.user_uuid || "";

          // Extract project ID from conversations if available
          let projectId = row.project_uuid || row.project_id || "";

          // If this is a conversation with a project ID, note it for later analysis
          if (isConversation && projectId) {
            console.log(
              `Found conversation associated with project: ${projectId}`
            );
            // Add a flag to easily identify project-related conversations
            row.has_project = true;
          }

          // For conversations, first try to match by UUID
          if (isConversation && userUuid && userUuidMap[userUuid]) {
            // We have a UUID match from conversations.json!
            const matchedUser = userUuidMap[userUuid];
            email = matchedUser.email;
            userName = matchedUser.name;

            console.log(
              `Matched conversation to user by UUID: ${userName} (${email})`
            );

            // Update user metrics in both maps
            userUuidMap[userUuid].totalActions++;
            userUuidMap[userUuid].conversations++;

            // If user exists in email map, update that too
            if (userMap[email]) {
              userMap[email].totalActions++;
              userMap[email].conversations++;

              // Update last seen date if this activity is more recent
              if (row.date && row.date > userMap[email].lastSeen) {
                userMap[email].lastSeen = row.date;
              }
            }

            // Skip the rest of the loop since we've already handled this record
            return;
          }

          // For projects, we'll try to associate with users based on available information
          if (isProject) {
            // For now, we'll count projects but not associate with specific users
            // since the sample data doesn't show a clear owner relationship
            console.log(
              `Processing project: ${row.filename || "Unnamed project"}`
            );

            // Try to associate project with a user if we have email or UUID
            if (userUuid && userUuidMap[userUuid]) {
              // We found a UUID match
              const matchedUser = userUuidMap[userUuid];
              userUuidMap[userUuid].totalActions++;
              userUuidMap[userUuid].projects++;

              // Also update the email map if it exists
              if (matchedUser.email && userMap[matchedUser.email]) {
                userMap[matchedUser.email].totalActions++;
                userMap[matchedUser.email].projects++;
              }

              console.log(
                `Associated project with user by UUID: ${matchedUser.name}`
              );
            } else if (email && userMap[email]) {
              // We found an email match
              userMap[email].totalActions++;
              userMap[email].projects++;
              console.log(
                `Associated project with user by email: ${userMap[email].name}`
              );
            }

            // If we can't match a specific user but have email information, try to create a user
            else if (email && !userMap[email] && email !== "") {
              userMap[email] = {
                name: userName || email.split("@")[0],
                email: email,
                totalActions: 1,
                conversations: 0,
                projects: 1, // This is their first project
                files: 0,
                lastSeen: row.date,
              };
              console.log(`Created new user from project: ${email}`);
            }
            // Otherwise, we'll still count the project in the total but not associate it
          }

          // For other cases, proceed with email-based matching as before
          if (!email || email === "") {
            try {
              const actorInfo =
                typeof row.actor_info === "string"
                  ? JSON.parse(row.actor_info.replace(/'/g, '"'))
                  : row.actor_info;

              // Try to get email from various possible locations
              email =
                actorInfo?.metadata?.email_address ||
                actorInfo?.email ||
                row.actor?.email_address ||
                row.actor?.email ||
                row.user?.email_address ||
                row.user?.email ||
                "";

              // If we got an email, also try to get user name
              if (email && !userName) {
                userName =
                  actorInfo?.name ||
                  actorInfo?.full_name ||
                  row.actor?.name ||
                  row.actor?.full_name ||
                  row.user?.name ||
                  row.user?.full_name ||
                  email.split("@")[0];
              }
            } catch (e) {
              console.log("Error parsing actor info:", e);
            }
          }

          // Skip entries without a valid email (avoid "Unknown" user entries)
          if (!email || email === "") {
            console.log(
              "Skipping entry without email:",
              row.source,
              row.id || row.uuid
            );
            return;
          }

          // If this is a new user we haven't seen in users.json, create an entry
          if (!userMap[email]) {
            // Use explicit name if available, or derive from email
            const derivedName = userName || email.split("@")[0];

            userMap[email] = {
              name: derivedName,
              email: email,
              totalActions: 0,
              conversations: 0,
              projects: 0,
              files: 0,
              lastSeen: row.date,
            };
          }

          // Update user metrics
          userMap[email].totalActions++;

          if (isConversation) userMap[email].conversations++;
          if (isProject) userMap[email].projects++;
          if (isFileUpload) userMap[email].files++;

          // Update last seen date if this activity is more recent
          if (row.date && row.date > userMap[email].lastSeen) {
            userMap[email].lastSeen = row.date;
          }
        });

        // After all user data is processed, filter out service accounts for certain displays
        // This occurs right before creating the daily metrics

        // Create a filtered version of userMetrics without service accounts for some visualizations
        const realUserMetrics = Object.values(userMap).filter(
          (user) =>
            user.email !== "service-account@system.internal" &&
            user.name !== "System Service Account" &&
            user.name !== "SECO Reconciliation service"
        );

        console.log(
          `Total users (including service accounts): ${
            Object.keys(userMap).length
          }`
        );
        console.log(
          `Real users (excluding service accounts): ${realUserMetrics.length}`
        );

        // Improved daily active users calculation
        // First, prepare a better identifier for each activity
        const activitiesWithUserInfo = fileData
          .map((item) => {
            // Skip users.json entries and service accounts
            if (
              item.source === "users.json" ||
              item.email === "service-account@system.internal" ||
              item.name === "System Service Account" ||
              item.name === "SECO Reconciliation service"
            ) {
              return null;
            }

            // Find matching user for this activity
            let userId = item.user_uuid || "";
            let userEmail = item.email || item.email_address || "";

            // For conversations with user_uuid, look up the email if missing
            if (userId && userUuidMap[userId] && !userEmail) {
              userEmail = userUuidMap[userId].email;
            }

            // For activities with email, get consistent user info
            if (userEmail && userMap[userEmail]) {
              userId = userMap[userEmail].uuid || userId;
            }

            return {
              ...item,
              // Create a unique user identifier that prioritizes uuid but falls back to email
              userIdentifier:
                userId ||
                userEmail ||
                `unknown-${item.uuid || item.filename || Math.random()}`,
              dateStr: item.dateStr,
            };
          })
          .filter(Boolean); // Remove null entries (service accounts/users.json)

        console.log(
          `Activities with user info: ${activitiesWithUserInfo.length}`
        );

        // Now calculate daily active users with improved uniqueness detection
        const dailyUsers = _.chain(activitiesWithUserInfo)
          .groupBy("dateStr")
          .map((rows, date) => {
            // Get unique users by their identifier
            const uniqueUsers = _.uniqBy(rows, "userIdentifier");
            console.log(
              `Date ${date}: ${uniqueUsers.length} unique users found`
            );

            return {
              date,
              activeUsers: uniqueUsers.length,
            };
          })
          .orderBy(["date"], ["asc"])
          .value();

        // Filter conversations by checking both event and source file
        const conversationData = fileData.filter(
          (d) =>
            (d.event === "conversation_created" ||
              d.source === "conversations.json") &&
            d.source !== "users.json" // Exclude users.json
        );

        // Calculate the date boundaries for 7-day and 30-day periods
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        console.log("Current date:", new Date().toISOString());
        console.log("7 days ago cutoff:", sevenDaysAgo.toISOString());
        console.log("30 days ago cutoff:", thirtyDaysAgo.toISOString());

        // Filter and count projects
        const projectData = fileData.filter(
          (d) =>
            (d.event === "project_created" || d.source === "projects.json") &&
            d.source !== "users.json" // Exclude users.json
        );

        console.log(`Total projects found: ${projectData.length}`);

        // Track conversations that belong to projects
        const projectConversations = conversationData.filter(
          (d) => d.project_uuid || d.project_id
        );

        console.log(
          `Found ${projectConversations.length} conversations associated with projects`
        );

        // Create a mapping of projects to their conversations
        const projectConversationMap = {};
        projectConversations.forEach((conv) => {
          const projectId = conv.project_uuid || conv.project_id;
          if (!projectConversationMap[projectId]) {
            projectConversationMap[projectId] = [];
          }
          projectConversationMap[projectId].push(conv);
        });

        // Count conversations per project
        const projectsWithConversationCounts = projectData.map((project) => {
          const projectId = project.uuid || project.id;
          const conversationsForProject =
            projectConversationMap[projectId] || [];

          // Count conversations in time periods for this project
          const last7DaysConvs = conversationsForProject.filter(
            (d) => new Date(d.date).getTime() >= sevenDaysAgo.getTime()
          ).length;

          const last30DaysConvs = conversationsForProject.filter(
            (d) => new Date(d.date).getTime() >= thirtyDaysAgo.getTime()
          ).length;

          return {
            ...project,
            conversationCount: conversationsForProject.length,
            last7DaysConversations: last7DaysConvs,
            last30DaysConversations: last30DaysConvs,
          };
        });

        // Count projects with conversations in time periods
        const projectsWithConversations = projectsWithConversationCounts.filter(
          (p) => p.conversationCount > 0
        );
        const projectsWithRecentConversations =
          projectsWithConversationCounts.filter(
            (p) => p.last7DaysConversations > 0
          );
        const projectsWithConversationsLast30Days =
          projectsWithConversationCounts.filter(
            (p) => p.last30DaysConversations > 0
          );

        console.log(
          `Projects with conversations: ${projectsWithConversations.length}`
        );
        console.log(
          `Projects with conversations in last 7 days: ${projectsWithRecentConversations.length}`
        );
        console.log(
          `Projects with conversations in last 30 days: ${projectsWithConversationsLast30Days.length}`
        );

        // Count projects in recent time periods
        const last7DaysProjects = projectData.filter(
          (d) => new Date(d.date).getTime() >= sevenDaysAgo.getTime()
        ).length;

        const last30DaysProjects = projectData.filter(
          (d) => new Date(d.date).getTime() >= thirtyDaysAgo.getTime()
        ).length;

        console.log(`Projects in last 7 days: ${last7DaysProjects}`);
        console.log(`Projects in last 30 days: ${last30DaysProjects}`);

        // Log some sample project dates for debugging
        if (projectData.length > 0) {
          console.log("Sample project dates:");
          for (let i = 0; i < Math.min(5, projectData.length); i++) {
            const item = projectData[i];
            console.log(
              `- ${item.dateStr}, Date object: ${item.date}, Filename: ${
                item.filename || "N/A"
              }`
            );
            console.log(
              `  7-day check: ${
                new Date(item.date).getTime() >= sevenDaysAgo.getTime()
              }`
            );
            console.log(
              `  30-day check: ${
                new Date(item.date).getTime() >= thirtyDaysAgo.getTime()
              }`
            );
          }
        }

        // Log some sample conversation dates for debugging
        if (conversationData.length > 0) {
          console.log("Sample conversation dates:");
          for (let i = 0; i < Math.min(5, conversationData.length); i++) {
            const item = conversationData[i];
            console.log(`- ${item.dateStr}, Date object: ${item.date}`);
            console.log(
              `  7-day check: ${
                new Date(item.date).getTime() >= sevenDaysAgo.getTime()
              }, Date compare: ${item.date.getTime()} >= ${sevenDaysAgo.getTime()}`
            );
            console.log(
              `  30-day check: ${
                new Date(item.date).getTime() >= thirtyDaysAgo.getTime()
              }, Date compare: ${item.date.getTime()} >= ${thirtyDaysAgo.getTime()}`
            );
          }
        }

        // Count conversations in time periods
        const last7DaysConversations = conversationData.filter(
          (d) => new Date(d.date).getTime() >= sevenDaysAgo.getTime()
        ).length;

        const last30DaysConversations = conversationData.filter(
          (d) => new Date(d.date).getTime() >= thirtyDaysAgo.getTime()
        ).length;

        console.log(`Conversations in last 7 days: ${last7DaysConversations}`);
        console.log(
          `Conversations in last 30 days: ${last30DaysConversations}`
        );

        const dailyConversations = _.chain(conversationData)
          .groupBy("dateStr")
          .map((rows, date) => ({
            date,
            conversations: rows.length,
          }))
          .orderBy(["date"], ["asc"])
          .value();

        // Create daily projects chart data
        const dailyProjects = _.chain(projectData)
          .groupBy("dateStr")
          .map((rows, date) => ({
            date,
            projects: rows.length,
          }))
          .orderBy(["date"], ["asc"])
          .value();

        // Count activities excluding users.json entries
        const activityData = fileData.filter((d) => d.source !== "users.json");

        setMetrics({
          userMetrics: Object.values(userMap),
          realUserMetrics: realUserMetrics,
          dailyUsers,
          dailyConversations,
          dailyProjects,
          totalUsers: realUserMetrics.length,
          totalConversations: conversationData.length,
          totalProjects: projectData.length,
          totalFiles: activityData.filter((d) => d.event === "file_uploaded")
            .length,
          hasConversationData,
          hasProjectData,
          hasUserData,
          last7DaysConversations,
          last30DaysConversations,
          last7DaysProjects,
          last30DaysProjects,
          conversationData,
          projectData,
          projectsWithConversationCounts,
          projectsWithConversations: projectsWithConversations.length,
          projectsWithRecentConversations:
            projectsWithRecentConversations.length,
          projectsWithConversationsLast30Days:
            projectsWithConversationsLast30Days.length,
          projectConversations,
          sevenDaysAgo,
          thirtyDaysAgo,
        });

        setIsLoading(false);
      } catch (error) {
        console.error("Error processing data:", error);
        setIsLoading(false);
      }
    };

    processData();
  }, [fileData]);

  if (isLoading || !metrics) {
    return <div className="p-4 text-center">Processing data...</div>;
  }

  // Simple project name display component that prioritizes the name field
  const ProjectName = ({ project }) => {
    return (
      <span className="truncate">{project.name || "Unnamed Project"}</span>
    );
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Usage Analytics Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers}
          icon={Users}
        />
        <MetricCard
          title="Total Conversations"
          value={metrics.totalConversations}
          icon={MessageSquare}
        />
        <MetricCard
          title="Total Projects"
          value={metrics.totalProjects}
          icon={FolderKanban}
        />
        <MetricCard
          title="Total Files"
          value={metrics.totalFiles}
          icon={FileText}
        />
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="Tabs">
            {["overview", "conversations", "projects", "users"]
              .filter(
                (tab) =>
                  (tab !== "conversations" || metrics.hasConversationData) &&
                  (tab !== "projects" || metrics.hasProjectData) &&
                  (tab !== "users" || metrics.hasUserData)
              )
              .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`${
                    activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                >
                  {tab}
                </button>
              ))}
          </nav>
        </div>
      </div>

      <div className="space-y-6">
        {activeTab === "overview" && (
          <>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Daily Active Users</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.dailyUsers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="activeUsers"
                      stroke="#3b82f6"
                      name="Active Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {metrics.hasProjectData && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium mb-4">Project Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Last 7 Days
                    </h3>
                    <div className="text-2xl font-bold">
                      {metrics.last7DaysProjects}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Last 30 Days
                    </h3>
                    <div className="text-2xl font-bold">
                      {metrics.last30DaysProjects}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      All Time
                    </h3>
                    <div className="text-2xl font-bold">
                      {metrics.totalProjects}
                    </div>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.dailyProjects}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="projects"
                        stroke="#10b981"
                        name="Projects"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8">
                  <h4 className="text-md font-medium mb-4">
                    Top Recent Projects
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2 text-left">Project</th>
                          <th className="px-4 py-2 text-left">Filename</th>
                          <th className="px-4 py-2 text-left">User</th>
                          <th className="px-4 py-2 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.projectData
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .slice(0, 5)
                          .map((project, index) => {
                            // Get creator name - either directly from project or via user lookup
                            let creatorName = project.creator_name || "Unknown";

                            // If no creator name but we have UUID, try to look it up
                            if (!creatorName && project.user_uuid) {
                              const userByUuid = metrics.userMetrics.find(
                                (u) => u.uuid === project.user_uuid
                              );
                              if (userByUuid) {
                                creatorName = userByUuid.name;
                              }
                            }

                            return (
                              <tr
                                key={index}
                                className={index % 2 === 0 ? "bg-gray-50" : ""}
                              >
                                <td className="px-4 py-2 text-sm w-1/2">
                                  <div className="flex items-center">
                                    <ProjectName project={project} />
                                    {project.document_count > 0 && (
                                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                        {project.document_count} doc
                                        {project.document_count !== 1
                                          ? "s"
                                          : ""}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {project.filename || "-"}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {creatorName}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {(() => {
                                    try {
                                      const date = new Date(project.date);
                                      return !isNaN(date.getTime())
                                        ? date.toLocaleDateString()
                                        : "Invalid date";
                                    } catch (error) {
                                      return "Error";
                                    }
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-md font-medium mb-4">
                    Top Project Creators
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2 text-left">User</th>
                          <th className="px-4 py-2 text-center">Last 7 Days</th>
                          <th className="px-4 py-2 text-center">
                            Last 30 Days
                          </th>
                          <th className="px-4 py-2 text-center">All Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {_.chain(metrics.realUserMetrics)
                          .filter((user) => user.projects > 0)
                          .orderBy(["projects"], ["desc"])
                          .slice(0, 5)
                          .map((user, index) => {
                            // Get this user's projects
                            const userProjects = metrics.projectData.filter(
                              (row) =>
                                row.email === user.email ||
                                row.email_address === user.email ||
                                (row.user_uuid && row.user_uuid === user.uuid)
                            );

                            // Count projects in time periods
                            const projects7d = userProjects.filter(
                              (row) =>
                                new Date(row.date).getTime() >=
                                metrics.sevenDaysAgo.getTime()
                            ).length;

                            const projects30d = userProjects.filter(
                              (row) =>
                                new Date(row.date).getTime() >=
                                metrics.thirtyDaysAgo.getTime()
                            ).length;

                            return (
                              <tr
                                key={index}
                                className={index % 2 === 0 ? "bg-gray-50" : ""}
                              >
                                <td className="px-4 py-2 text-sm font-medium">
                                  {user.name}
                                </td>
                                <td className="px-4 py-2 text-sm text-center">
                                  {projects7d}
                                </td>
                                <td className="px-4 py-2 text-sm text-center">
                                  {projects30d}
                                </td>
                                <td className="px-4 py-2 text-sm text-center">
                                  {user.projects}
                                </td>
                              </tr>
                            );
                          })
                          .value()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {metrics.projectConversations &&
                  metrics.projectConversations.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-md font-medium mb-4">
                        Project Conversations Summary
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-600 mb-2">
                            Projects with Conversations
                          </h3>
                          <div className="text-xl font-bold">
                            {metrics.projectsWithConversations || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {metrics.totalProjects > 0
                              ? `${Math.round(
                                  (metrics.projectsWithConversations /
                                    metrics.totalProjects) *
                                    100
                                )}% of all projects`
                              : "0% of all projects"}
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-600 mb-2">
                            Conversations in Projects
                          </h3>
                          <div className="text-xl font-bold">
                            {metrics.projectConversations?.length || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {metrics.totalConversations > 0
                              ? `${Math.round(
                                  (metrics.projectConversations.length /
                                    metrics.totalConversations) *
                                    100
                                )}% of all conversations`
                              : "0% of all conversations"}
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-600 mb-2">
                            Avg. Conversations per Project
                          </h3>
                          <div className="text-xl font-bold">
                            {metrics.projectsWithConversations > 0
                              ? (
                                  metrics.projectConversations.length /
                                  metrics.projectsWithConversations
                                ).toFixed(1)
                              : "0"}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-4 py-2 text-left">Project</th>
                              <th className="px-4 py-2 text-left">User</th>
                              <th className="px-4 py-2 text-center">
                                Conversations
                              </th>
                              <th className="px-4 py-2 text-left">
                                Last Conversation
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.projectsWithConversationCounts
                              .filter(
                                (project) => project.conversationCount > 0
                              )
                              .sort(
                                (a, b) =>
                                  b.conversationCount - a.conversationCount
                              )
                              .slice(0, 5)
                              .map((project, index) => {
                                // Get creator name - either directly from project or via user lookup
                                let creatorName =
                                  project.creator_name || "Unknown";

                                // If no creator name but we have UUID, try to look it up
                                if (!creatorName && project.user_uuid) {
                                  const userByUuid = metrics.userMetrics.find(
                                    (u) => u.uuid === project.user_uuid
                                  );
                                  if (userByUuid) {
                                    creatorName = userByUuid.name;
                                  }
                                }

                                return (
                                  <tr
                                    key={index}
                                    className={
                                      index % 2 === 0 ? "bg-gray-50" : ""
                                    }
                                  >
                                    <td className="px-4 py-2 text-sm">
                                      <div className="flex items-center">
                                        <ProjectName project={project} />
                                        {project.document_count > 0 && (
                                          <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                            {project.document_count} doc
                                            {project.document_count !== 1
                                              ? "s"
                                              : ""}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      {creatorName}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-center">
                                      {project.conversationCount}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      {project.conversationCount > 0
                                        ? (() => {
                                            try {
                                              const projectConvs =
                                                metrics.projectConversations.filter(
                                                  (conv) =>
                                                    conv.project_uuid ===
                                                      project.uuid ||
                                                    conv.project_id ===
                                                      project.uuid
                                                );

                                              if (projectConvs.length === 0)
                                                return "N/A";

                                              const validDates = projectConvs
                                                .map((conv) => {
                                                  const date = new Date(
                                                    conv.date
                                                  );
                                                  return isNaN(date.getTime())
                                                    ? null
                                                    : date.getTime();
                                                })
                                                .filter(
                                                  (time) => time !== null
                                                );

                                              if (validDates.length === 0)
                                                return "Invalid date";

                                              return new Date(
                                                Math.max(...validDates)
                                              ).toLocaleDateString();
                                            } catch (error) {
                                              console.error(
                                                "Error formatting conversation date:",
                                                error
                                              );
                                              return "Error";
                                            }
                                          })()
                                        : "N/A"}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {activeTab === "users" && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">User Information</h3>
            <SortableTable
              data={metrics.realUserMetrics.map((user) => {
                // Find all activities for this user
                const userConversations = metrics.conversationData.filter(
                  (row) =>
                    row.email === user.email ||
                    row.email_address === user.email ||
                    (row.user_uuid && row.user_uuid === user.uuid)
                );

                const userProjects = metrics.projectData.filter(
                  (row) =>
                    row.email === user.email ||
                    row.email_address === user.email ||
                    (row.user_uuid && row.user_uuid === user.uuid)
                );

                // Calculate last seen date from the user's actual activity history
                let lastSeenDate = user.lastSeen;

                // Check conversations
                if (userConversations.length > 0) {
                  // Extract and validate dates from conversations
                  const validDates = userConversations
                    .map((conv) => new Date(conv.date))
                    .filter((date) => !isNaN(date.getTime()));

                  // Sort dates in descending order and get the most recent one
                  if (validDates.length > 0) {
                    validDates.sort((a, b) => b.getTime() - a.getTime());
                    lastSeenDate = validDates[0];
                  }
                }

                // Check projects (if no conversation date was found)
                if (userProjects.length > 0 && !lastSeenDate) {
                  // Extract and validate dates from projects
                  const validDates = userProjects
                    .map((proj) => new Date(proj.date))
                    .filter((date) => !isNaN(date.getTime()));

                  // Sort dates in descending order and get the most recent one
                  if (validDates.length > 0) {
                    validDates.sort((a, b) => b.getTime() - a.getTime());
                    lastSeenDate = validDates[0];
                  }
                }

                return {
                  name: user.name,
                  email: user.email,
                  phone: user.phone || "Not provided",
                  uuid: user.uuid || "N/A",
                  totalActivities: user.totalActions,
                  conversations: user.conversations,
                  projects: user.projects,
                  lastSeen: lastSeenDate,
                };
              })}
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "totalActivities", label: "Total Activities" },
                { key: "conversations", label: "Conversations" },
                { key: "projects", label: "Projects" },
                {
                  key: "lastSeen",
                  label: "Last Seen",
                  format: (date) => {
                    if (date instanceof Date && !isNaN(date.getTime())) {
                      return date.toLocaleDateString();
                    } else if (date) {
                      return "Invalid date";
                    } else {
                      return "No activity yet";
                    }
                  },
                },
              ]}
            />
          </div>
        )}

        {activeTab === "conversations" && metrics.hasConversationData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Last 7 Days
                </h3>
                <div className="text-2xl font-bold">
                  {metrics.last7DaysConversations}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Last 30 Days
                </h3>
                <div className="text-2xl font-bold">
                  {metrics.last30DaysConversations}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  All Time
                </h3>
                <div className="text-2xl font-bold">
                  {
                    fileData.filter(
                      (row) =>
                        (row.event === "conversation_created" ||
                          row.source === "conversations.json") &&
                        row.source !== "users.json"
                    ).length
                  }
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">
                Conversations by User
              </h3>
              <SortableTable
                data={_.chain(metrics.realUserMetrics)
                  .filter((user) => user.conversations > 0)
                  .map((user) => {
                    // Get this user's conversations
                    const userConversations = metrics.conversationData.filter(
                      (row) =>
                        row.email === user.email ||
                        row.email_address === user.email ||
                        (row.user_uuid && row.user_uuid === user.uuid)
                    );

                    // Filter by time periods
                    const conversations7d = userConversations.filter(
                      (row) =>
                        new Date(row.date).getTime() >=
                        metrics.sevenDaysAgo.getTime()
                    ).length;

                    const conversations30d = userConversations.filter(
                      (row) =>
                        new Date(row.date).getTime() >=
                        metrics.thirtyDaysAgo.getTime()
                    ).length;

                    // Calculate last seen date from the user's actual conversation history
                    let lastSeenDate = user.lastSeen;

                    if (userConversations.length > 0) {
                      // Extract and validate dates from conversations
                      const validDates = userConversations
                        .map((conv) => new Date(conv.date))
                        .filter((date) => !isNaN(date.getTime()));

                      // Sort dates in descending order and get the most recent one
                      if (validDates.length > 0) {
                        validDates.sort((a, b) => b.getTime() - a.getTime());
                        lastSeenDate = validDates[0];
                      }
                    }

                    return {
                      name: user.name,
                      email: user.email,
                      conversations7d,
                      conversations30d,
                      conversationsTotal: user.conversations,
                      lastSeen: lastSeenDate,
                    };
                  })
                  .orderBy(["conversationsTotal"], ["desc"])
                  .value()}
                columns={[
                  { key: "name", label: "User" },
                  { key: "conversations7d", label: "Last 7 Days" },
                  { key: "conversations30d", label: "Last 30 Days" },
                  { key: "conversationsTotal", label: "All Time" },
                  {
                    key: "lastSeen",
                    label: "Last Seen",
                    format: (date) => {
                      if (date instanceof Date && !isNaN(date.getTime())) {
                        return date.toLocaleDateString();
                      } else if (date) {
                        return "Invalid date";
                      } else {
                        return "No activity yet";
                      }
                    },
                  },
                ]}
              />
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Daily Conversations</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.dailyConversations}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="conversations"
                      stroke="#3b82f6"
                      name="Conversations"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === "projects" && metrics.hasProjectData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Last 7 Days
                </h3>
                <div className="text-2xl font-bold">
                  {metrics.last7DaysProjects}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Last 30 Days
                </h3>
                <div className="text-2xl font-bold">
                  {metrics.last30DaysProjects}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  All Time
                </h3>
                <div className="text-2xl font-bold">
                  {metrics.totalProjects}
                </div>
              </div>
            </div>

            {metrics.projectConversations &&
              metrics.projectConversations.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-4">
                    Project Conversations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">
                        Projects with Chats (Last 7 Days)
                      </h3>
                      <div className="text-2xl font-bold">
                        {metrics.projectsWithRecentConversations || 0}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">
                        Projects with Chats (Last 30 Days)
                      </h3>
                      <div className="text-2xl font-bold">
                        {metrics.projectsWithConversationsLast30Days || 0}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">
                        Projects with Chats (All Time)
                      </h3>
                      <div className="text-2xl font-bold">
                        {metrics.projectsWithConversations || 0}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-md font-medium mb-4">
                      Top Projects by Conversation Count
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-4 py-2 text-left">
                              Project Name
                            </th>
                            <th className="px-4 py-2 text-left">Creator</th>
                            <th className="px-4 py-2 text-center">Documents</th>
                            <th className="px-4 py-2 text-left">Date</th>
                            <th className="px-4 py-2 text-center">
                              Last 7 Days
                            </th>
                            <th className="px-4 py-2 text-center">
                              Last 30 Days
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.projectsWithConversationCounts
                            .filter((project) => project.conversationCount > 0)
                            .sort(
                              (a, b) =>
                                b.conversationCount - a.conversationCount
                            )
                            .slice(0, 10)
                            .map((project, index) => {
                              // Get creator name - either directly from project or via user lookup
                              let creatorName =
                                project.creator_name || "Unknown";

                              // If no creator name but we have UUID, try to look it up
                              if (!creatorName && project.user_uuid) {
                                const userByUuid = metrics.userMetrics.find(
                                  (u) => u.uuid === project.user_uuid
                                );
                                if (userByUuid) {
                                  creatorName = userByUuid.name;
                                }
                              }

                              return (
                                <tr
                                  key={index}
                                  className={
                                    index % 2 === 0 ? "bg-gray-50" : ""
                                  }
                                >
                                  <td className="px-4 py-2 text-sm">
                                    <div className="flex items-center">
                                      <ProjectName project={project} />
                                      {project.document_count > 0 && (
                                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                          {project.document_count} doc
                                          {project.document_count !== 1
                                            ? "s"
                                            : ""}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    {creatorName}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-center">
                                    {project.document_count || 0}
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    {(() => {
                                      try {
                                        const date = new Date(project.date);
                                        return !isNaN(date.getTime())
                                          ? date.toLocaleDateString()
                                          : "Invalid date";
                                      } catch (error) {
                                        return "Error";
                                      }
                                    })()}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-center">
                                    {(() => {
                                      try {
                                        const date = new Date(project.date);
                                        return !isNaN(date.getTime()) &&
                                          date >= metrics.sevenDaysAgo
                                          ? "✓"
                                          : "-";
                                      } catch (error) {
                                        return "-";
                                      }
                                    })()}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-center">
                                    {(() => {
                                      try {
                                        const date = new Date(project.date);
                                        return !isNaN(date.getTime()) &&
                                          date >= metrics.thirtyDaysAgo
                                          ? "✓"
                                          : "-";
                                      } catch (error) {
                                        return "-";
                                      }
                                    })()}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Projects by User</h3>
              <SortableTable
                data={_.chain(metrics.realUserMetrics)
                  .filter((user) => user.projects > 0)
                  .map((user) => {
                    // Get this user's projects
                    const userProjects = metrics.projectData.filter(
                      (row) =>
                        row.email === user.email ||
                        row.email_address === user.email ||
                        (row.user_uuid && row.user_uuid === user.uuid)
                    );

                    // Calculate last project date
                    let lastProjectDate = null;

                    if (userProjects.length > 0) {
                      // Extract and validate dates from projects
                      const validDates = userProjects
                        .map((proj) => new Date(proj.date))
                        .filter((date) => !isNaN(date.getTime()));

                      // Sort dates in descending order and get the most recent one
                      if (validDates.length > 0) {
                        validDates.sort((a, b) => b.getTime() - a.getTime());
                        lastProjectDate = validDates[0];
                      }
                    }

                    return {
                      name: user.name,
                      email: user.email,
                      projects7d: userProjects.filter(
                        (row) =>
                          new Date(row.date).getTime() >=
                          metrics.sevenDaysAgo.getTime()
                      ).length,
                      projects30d: userProjects.filter(
                        (row) =>
                          new Date(row.date).getTime() >=
                          metrics.thirtyDaysAgo.getTime()
                      ).length,
                      projectsTotal: user.projects,
                      lastProject: lastProjectDate,
                    };
                  })
                  .orderBy(["projectsTotal"], ["desc"])
                  .value()}
                columns={[
                  { key: "name", label: "User" },
                  { key: "projects7d", label: "Last 7 Days" },
                  { key: "projects30d", label: "Last 30 Days" },
                  { key: "projectsTotal", label: "All Time" },
                  {
                    key: "lastProject",
                    label: "Last Project",
                    format: (date) =>
                      date ? date.toLocaleDateString() : "No activity yet",
                  },
                ]}
              />
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Projects Timeline</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.dailyProjects}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="projects"
                      stroke="#10b981"
                      name="Projects"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Project List</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Project Name</th>
                      <th className="px-4 py-2 text-left">Creator</th>
                      <th className="px-4 py-2 text-center">Documents</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-center">Last 7 Days</th>
                      <th className="px-4 py-2 text-center">Last 30 Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.projectData
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((project, index) => {
                        // Get creator name - either directly from project or via user lookup
                        let creatorName = project.creator_name || "Unknown";

                        // If no creator name but we have UUID, try to look it up
                        if (!creatorName && project.user_uuid) {
                          const userByUuid = metrics.userMetrics.find(
                            (u) => u.uuid === project.user_uuid
                          );
                          if (userByUuid) {
                            creatorName = userByUuid.name;
                          }
                        }

                        return (
                          <tr
                            key={index}
                            className={index % 2 === 0 ? "bg-gray-50" : ""}
                          >
                            <td className="px-4 py-2 text-sm">
                              <div className="flex items-center">
                                <ProjectName project={project} />
                                {project.document_count > 0 && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                    {project.document_count} doc
                                    {project.document_count !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm">{creatorName}</td>
                            <td className="px-4 py-2 text-sm text-center">
                              {project.document_count || 0}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {(() => {
                                try {
                                  const date = new Date(project.date);
                                  return !isNaN(date.getTime())
                                    ? date.toLocaleDateString()
                                    : "Invalid date";
                                } catch (error) {
                                  return "Error";
                                }
                              })()}
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              {(() => {
                                try {
                                  const date = new Date(project.date);
                                  return !isNaN(date.getTime()) &&
                                    date >= metrics.sevenDaysAgo
                                    ? "✓"
                                    : "-";
                                } catch (error) {
                                  return "-";
                                }
                              })()}
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              {(() => {
                                try {
                                  const date = new Date(project.date);
                                  return !isNaN(date.getTime()) &&
                                    date >= metrics.thirtyDaysAgo
                                    ? "✓"
                                    : "-";
                                } catch (error) {
                                  return "-";
                                }
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
