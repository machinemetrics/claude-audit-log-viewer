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
  BarChart,
  Bar,
} from "recharts";
import { Users, MessageSquare, FolderKanban, FileText, X } from "lucide-react";
import _ from "lodash";

import MetricCard from "./shared/MetricCard";
import SortableTable from "./shared/SortableTable";

// No longer need project name helper functions since we'll use the name field directly

const Dashboard = ({ fileData }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!fileData) {
      setIsLoading(false);
      return;
    }

    const processData = () => {
      try {
        // Helper function to get the first day of the week (Sunday) for a given date
        const getFirstDayOfWeek = (date) => {
          const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const firstDayOfWeek = new Date(date);
          // Set to first day of week (Sunday)
          firstDayOfWeek.setDate(date.getDate() - dayOfWeek);
          return firstDayOfWeek;
        };

        // Helper function to format a week range consistently
        const formatWeekRange = (weekStartDate) => {
          const weekDate = new Date(weekStartDate);

          // Calculate week number (1-52)
          const startOfYear = new Date(weekDate.getFullYear(), 0, 1);
          const weekNum = Math.ceil(
            ((weekDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
          );

          // Calculate the end date of the week (Saturday)
          const endOfWeek = new Date(weekDate);
          endOfWeek.setDate(weekDate.getDate() + 6); // Add 6 days to get to Saturday

          // Format dates for display
          const startMonth = weekDate.getMonth() + 1;
          const startDay = weekDate.getDate();
          const endMonth = endOfWeek.getMonth() + 1;
          const endDay = endOfWeek.getDate();

          // Create a week label that shows the date range
          const weekRange = `${startMonth}/${startDay}-${endMonth}/${endDay}`;

          return {
            weekNum,
            weekRange,
            endOfWeek,
          };
        };

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

        // Filter and count projects (include all projects, not just public ones)
        const projectData = fileData.filter(
          (d) =>
            (d.event === "project_created" || d.source === "projects.json") &&
            d.source !== "users.json" // Exclude users.json
        );

        // Ensure all projects have the correct document_count
        projectData.forEach((project) => {
          project.document_count =
            project.document_count ||
            project.docs?.length ||
            project.documents?.length ||
            0;
        });

        console.log(`Total projects found: ${projectData.length}`);

        // Debug log the first few projects and their document counts
        if (projectData.length > 0) {
          console.log("Sample project document counts:");
          for (let i = 0; i < Math.min(5, projectData.length); i++) {
            console.log(
              `Project "${projectData[i].name}": ${
                projectData[i].document_count || 0
              } documents (from docs array: ${
                projectData[i].docs?.length || 0
              })`
            );
          }
        }

        // Calculate total documents across all projects
        const totalDocuments = projectData.reduce((sum, project) => {
          // First try to use the document_count property
          // If that's 0, check the docs array directly
          const count =
            project.document_count ||
            project.docs?.length ||
            project.documents?.length ||
            0;
          return sum + count;
        }, 0);
        console.log(`Total documents across all projects: ${totalDocuments}`);

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
            document_count:
              project.document_count ||
              project.docs?.length ||
              project.documents?.length ||
              0,
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

        // In the processData function, add weekly user calculation
        // First, create a map of all dates to their respective week start dates
        const dateToWeekMap = {};

        // Create a map to track all unique users for each day
        const usersByDay = {};

        // Process all activities and organize them by day
        activitiesWithUserInfo.forEach((item) => {
          const date = new Date(item.date);
          const firstDayOfWeek = getFirstDayOfWeek(date);
          const weekStart = firstDayOfWeek.toISOString().split("T")[0]; // YYYY-MM-DD format

          // Store the mapping from date string to week start
          dateToWeekMap[item.dateStr] = weekStart;

          // Add this user to the appropriate day
          if (!usersByDay[item.dateStr]) {
            usersByDay[item.dateStr] = new Set();
          }
          usersByDay[item.dateStr].add(item.userIdentifier);
        });

        // Group days by week
        const daysByWeek = {};
        Object.keys(usersByDay).forEach((dayStr) => {
          const weekStart = dateToWeekMap[dayStr];
          if (!daysByWeek[weekStart]) {
            daysByWeek[weekStart] = [];
          }
          daysByWeek[weekStart].push(dayStr);
        });

        // Now calculate weekly users by counting all unique users across all days in each week
        const weeklyUsers = Object.entries(daysByWeek)
          .map(([weekStart, daysInWeek]) => {
            // Collect all unique users from all days in this week
            const allUsersInWeek = new Set();
            daysInWeek.forEach((dayStr) => {
              const usersForDay = usersByDay[dayStr];
              if (usersForDay) {
                usersForDay.forEach((userId) => allUsersInWeek.add(userId));
              }
            });

            // Use the same helper function for consistent week formatting
            const weekDate = new Date(weekStart);
            const { weekNum, weekRange, endOfWeek } = formatWeekRange(weekDate);

            // Count unique users for this week
            const uniqueUserCount = allUsersInWeek.size;

            console.log(
              `USERS Week ${weekNum} (${weekStart} to ${
                endOfWeek.toISOString().split("T")[0]
              }): ${uniqueUserCount} unique users, date range: ${weekRange}`
            );

            // Also log the daily counts for debugging
            daysInWeek.forEach((dayStr) => {
              const dayUsers = usersByDay[dayStr] ? usersByDay[dayStr].size : 0;
              console.log(`  - Day ${dayStr}: ${dayUsers} users`);
            });

            return {
              date: weekStart,
              weekNum: weekNum,
              weekLabel: weekRange,
              weekRange: weekRange,
              activeUsers: uniqueUserCount,
              daysWithActivity: daysInWeek.length,
              userIds: Array.from(allUsersInWeek), // Store the actual user IDs for later aggregation
            };
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending

        // Calculate unique users for different time periods
        const last7DaysUniqueUsers = new Set();
        const last30DaysUniqueUsers = new Set();
        const allTimeUniqueUsers = new Set(); // New Set for all-time unique users

        // Process all activities to count unique users in different time periods
        activitiesWithUserInfo.forEach((item) => {
          const date = new Date(item.date);

          // Add to all-time unique users set
          allTimeUniqueUsers.add(item.userIdentifier);

          // Check if this activity is within the last 7 days
          if (date >= sevenDaysAgo) {
            last7DaysUniqueUsers.add(item.userIdentifier);
          }

          // Check if this activity is within the last 30 days
          if (date >= thirtyDaysAgo) {
            last30DaysUniqueUsers.add(item.userIdentifier);
          }
        });

        console.log(
          `Unique users in last 7 days: ${last7DaysUniqueUsers.size}`
        );
        console.log(
          `Unique users in last 30 days: ${last30DaysUniqueUsers.size}`
        );
        console.log(`All-time unique users: ${allTimeUniqueUsers.size}`);

        // Use the same week calculation approach for conversations as we do for users
        // First, create a map for conversations similar to the user map
        const convsByDay = {};
        const convDateToWeekMap = {};

        // Process all conversations and organize them by day
        conversationData.forEach((conv) => {
          const date = new Date(conv.date);
          const dayStr = conv.dateStr;
          const firstDayOfWeek = getFirstDayOfWeek(date);
          const weekStart = firstDayOfWeek.toISOString().split("T")[0]; // YYYY-MM-DD format

          // Store the mapping from date string to week start
          convDateToWeekMap[dayStr] = weekStart;

          // Add this conversation to the appropriate day
          if (!convsByDay[dayStr]) {
            convsByDay[dayStr] = [];
          }
          convsByDay[dayStr].push(conv);
        });

        // Group days by week
        const convDaysByWeek = {};
        Object.keys(convsByDay).forEach((dayStr) => {
          const weekStart = convDateToWeekMap[dayStr];
          if (!convDaysByWeek[weekStart]) {
            convDaysByWeek[weekStart] = [];
          }
          convDaysByWeek[weekStart].push(dayStr);
        });

        // Now calculate weekly conversations using the exact same approach as weekly users
        const weeklyConversations = Object.entries(convDaysByWeek)
          .map(([weekStart, daysInWeek]) => {
            // Count all conversations across all days in this week
            let totalConversations = 0;
            daysInWeek.forEach((dayStr) => {
              const conversationsForDay = convsByDay[dayStr] || [];
              totalConversations += conversationsForDay.length;
            });

            // Use the same helper function for consistent week formatting
            const weekDate = new Date(weekStart);
            const { weekNum, weekRange, endOfWeek } = formatWeekRange(weekDate);

            console.log(
              `CONV Week ${weekNum} (${weekStart} to ${
                endOfWeek.toISOString().split("T")[0]
              }): ${totalConversations} conversations, date range: ${weekRange}`
            );

            // Also log the daily counts for debugging
            daysInWeek.forEach((dayStr) => {
              const dayConvs = convsByDay[dayStr]
                ? convsByDay[dayStr].length
                : 0;
              console.log(`  - Day ${dayStr}: ${dayConvs} conversations`);
            });

            return {
              date: weekStart,
              weekNum: weekNum,
              weekLabel: weekRange,
              weekRange: weekRange,
              conversations: totalConversations,
            };
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending

        setMetrics({
          userMetrics: Object.values(userMap),
          realUserMetrics: realUserMetrics,
          dailyUsers,
          weeklyUsers,
          dailyConversations,
          dailyProjects,
          totalUsers: allTimeUniqueUsers.size, // Use all-time unique users count instead of realUserMetrics.length
          totalConversations: conversationData.length,
          totalProjects: projectData.length,
          totalDocuments: totalDocuments,
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
          last7DaysUniqueUsers: last7DaysUniqueUsers.size,
          last30DaysUniqueUsers: last30DaysUniqueUsers.size,
          allTimeUniqueUsers: allTimeUniqueUsers.size, // Add this for clarity
          weeklyConversations,
          convDateToWeekMap,
          convsByDay,
          convDaysByWeek,
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

  // Function to handle clicking on a day or week
  const handlePeriodClick = (period) => {
    setSelectedPeriod(period);
    setShowModal(true);
  };

  // Function to close the modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedPeriod(null);
  };

  // Function to get conversations for the selected period
  const getConversationsForPeriod = () => {
    if (!selectedPeriod || !metrics) return [];

    // If it's a day (from daily chart)
    if (selectedPeriod.type === "day") {
      const date = selectedPeriod.date;
      // Filter conversations that occurred on this day
      return metrics.conversationData.filter((conv) => conv.dateStr === date);
    }

    // If it's a week (from weekly chart)
    if (selectedPeriod.type === "week") {
      const weekStart = new Date(selectedPeriod.date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Add 6 days to get to end of week

      // Find the correct conversations for this week using the same approach as in the weekly calculation
      // This ensures the modal data matches the chart data
      const weekStartStr = weekStart.toISOString().split("T")[0]; // YYYY-MM-DD format

      // Option 1: Use the weekStart to match directly with our weekly calculation
      const weekData = metrics.weeklyConversations.find(
        (w) => w.date === weekStartStr
      );

      if (weekData) {
        console.log(
          `Selected week ${weekData.weekNum}: ${weekData.weekRange} with ${weekData.conversations} conversations`
        );
      }

      // These are all the conversations that should be in this week
      const daysInSelectedWeek = [];

      // Get all the days that belong to this week
      Object.entries(metrics.convDateToWeekMap || {}).forEach(
        ([dayStr, weekStartDate]) => {
          if (weekStartDate === weekStartStr) {
            daysInSelectedWeek.push(dayStr);
          }
        }
      );

      console.log(`Days in selected week: ${daysInSelectedWeek.join(", ")}`);

      // Get all conversations from these days
      return metrics.conversationData.filter((conv) =>
        daysInSelectedWeek.includes(conv.dateStr)
      );
    }

    return [];
  };

  // Function to get users with conversations in the selected period
  const getUsersWithConversationsInPeriod = () => {
    const periodConversations = getConversationsForPeriod();
    if (periodConversations.length === 0) return [];

    // Group conversations by user
    const userConversations = {};

    periodConversations.forEach((conv) => {
      // Try to find the user by UUID or email
      const userUuid = conv.user_uuid || "";
      const userEmail = conv.email || conv.email_address || "";

      let userName = "Unknown User";
      let userIdentifier = userUuid || userEmail || "unknown";

      // Try to find the user in our metrics
      const matchedUser = metrics.userMetrics.find(
        (u) =>
          (userUuid && u.uuid === userUuid) ||
          (userEmail && u.email === userEmail)
      );

      if (matchedUser) {
        userName = matchedUser.name;
        userIdentifier = matchedUser.uuid || matchedUser.email;
      }

      // Add to our grouping
      if (!userConversations[userIdentifier]) {
        userConversations[userIdentifier] = {
          name: userName,
          conversations: [],
        };
      }

      userConversations[userIdentifier].conversations.push(conv);
    });

    // Convert to array and sort by conversation count
    return Object.values(userConversations)
      .map((user) => ({
        ...user,
        conversationCount: user.conversations.length,
      }))
      .sort((a, b) => b.conversationCount - a.conversationCount);
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
          title="Total Documents"
          value={metrics.totalDocuments}
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
                  <LineChart
                    data={metrics.dailyUsers}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        handlePeriodClick({
                          type: "day",
                          date: data.activeLabel,
                          label: `Day: ${data.activeLabel}`,
                        });
                      }
                    }}
                  >
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
                <h3 className="text-lg font-medium mb-4">
                  Weekly Active Users
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Last 7 Days
                    </h3>
                    <div className="text-2xl font-bold">
                      {(() => {
                        // Get all unique users from the last 7 days
                        const uniqueUsersLast7Days = new Set();
                        metrics.weeklyUsers
                          .filter((week) => {
                            const weekDate = new Date(week.date);
                            return (
                              !isNaN(weekDate.getTime()) &&
                              weekDate >= metrics.sevenDaysAgo
                            );
                          })
                          .forEach((week) => {
                            // For each week, get the days in that week
                            const daysInWeek = week.daysWithActivity || 0;
                            // Add the unique users from this week
                            uniqueUsersLast7Days.add(week.activeUsers);
                          });

                        // Return the count of unique users
                        return (
                          metrics.last7DaysUniqueUsers || metrics.totalUsers
                        );
                      })()}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Last 30 Days
                    </h3>
                    <div className="text-2xl font-bold">
                      {(() => {
                        // Get all unique users from the last 30 days
                        const uniqueUsersLast30Days = new Set();
                        metrics.weeklyUsers
                          .filter((week) => {
                            const weekDate = new Date(week.date);
                            return (
                              !isNaN(weekDate.getTime()) &&
                              weekDate >= metrics.thirtyDaysAgo
                            );
                          })
                          .forEach((week) => {
                            // For each week, get the days in that week
                            const daysInWeek = week.daysWithActivity || 0;
                            // Add the unique users from this week
                            uniqueUsersLast30Days.add(week.activeUsers);
                          });

                        // Return the count of unique users
                        return (
                          metrics.last30DaysUniqueUsers || metrics.totalUsers
                        );
                      })()}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      All Time
                    </h3>
                    <div className="text-2xl font-bold">
                      {metrics.totalUsers}
                    </div>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.weeklyUsers}
                      onClick={(data) => {
                        if (data && data.activeLabel) {
                          const weekObj = metrics.weeklyUsers.find(
                            (w) => w.date === data.activeLabel
                          );
                          handlePeriodClick({
                            type: "week",
                            date: data.activeLabel,
                            weekNum: weekObj?.weekNum,
                            weekRange: weekObj?.weekRange,
                            label: weekObj
                              ? `Week ${weekObj.weekNum}: ${weekObj.weekRange}`
                              : `Week of ${data.activeLabel}`,
                          });
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(dateStr) => {
                          // Format as a single date (MM/DD)
                          const date = new Date(dateStr);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(dateStr) => {
                          // Find the corresponding week object for better labeling
                          const weekObj = metrics.weeklyUsers.find(
                            (w) => w.date === dateStr
                          );
                          if (weekObj) {
                            return `Week ${weekObj.weekNum}: ${weekObj.weekRange}`;
                          }
                          const date = new Date(dateStr);
                          return `Week Starting ${
                            date.getMonth() + 1
                          }/${date.getDate()}/${date.getFullYear()}`;
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="activeUsers"
                        fill="#10b981"
                        name="Active Users"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
                  totalActivities: user.totalActions,
                  conversations: user.conversations,
                  projects: user.projects,
                  lastSeen: lastSeenDate,
                };
              })}
              columns={[
                { key: "name", label: "Name" },
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
                      conversations7d,
                      conversations30d,
                      conversationsTotal: user.conversations,
                      lastSeen: lastSeenDate,
                    };
                  })
                  .orderBy(["conversations7d"], ["desc"]) // Sort by most conversations in the last 7 days
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
                  <LineChart
                    data={metrics.dailyConversations}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        handlePeriodClick({
                          type: "day",
                          date: data.activeLabel,
                          label: `Day: ${data.activeLabel}`,
                        });
                      }
                    }}
                  >
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

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Weekly Conversations</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.weeklyConversations}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        const weekObj = metrics.weeklyConversations.find(
                          (w) => w.date === data.activeLabel
                        );
                        handlePeriodClick({
                          type: "week",
                          date: data.activeLabel,
                          weekNum: weekObj?.weekNum,
                          weekRange: weekObj?.weekRange,
                          label: weekObj
                            ? `Week ${weekObj.weekNum}: ${weekObj.weekRange}`
                            : `Week of ${data.activeLabel}`,
                        });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(dateStr) => {
                        // Format as a single date (MM/DD)
                        const date = new Date(dateStr);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(dateStr) => {
                        // Find the corresponding week object for better labeling
                        const weekObj = metrics.weeklyConversations.find(
                          (w) => w.date === dateStr
                        );
                        if (weekObj) {
                          return `Week ${weekObj.weekNum}: ${weekObj.weekRange} (${weekObj.conversations} conversations)`;
                        }
                        const date = new Date(dateStr);
                        return `Week Starting ${
                          date.getMonth() + 1
                        }/${date.getDate()}/${date.getFullYear()}`;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="conversations"
                      fill="#3b82f6"
                      name="Conversations"
                    />
                  </BarChart>
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
                            <th className="px-4 py-2 text-center">Access</th>
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
                                    <span
                                      className={`px-2 py-1 text-xs rounded-full ${
                                        project.is_private
                                          ? "bg-red-100 text-red-700"
                                          : "bg-green-100 text-green-700"
                                      }`}
                                    >
                                      {project.is_private
                                        ? "Private"
                                        : "Public"}
                                    </span>
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
              <h3 className="text-lg font-medium mb-4">Project List</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Project Name</th>
                      <th className="px-4 py-2 text-left">Creator</th>
                      <th className="px-4 py-2 text-center">Documents</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-center">Access</th>
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
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  project.is_private
                                    ? "bg-red-100 text-red-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {project.is_private ? "Private" : "Public"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-md font-medium mb-4">Top Project Creators</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-center">Last 7 Days</th>
                      <th className="px-4 py-2 text-center">Last 30 Days</th>
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
          </div>
        )}
      </div>

      {/* Modal for showing conversations by user for selected period */}
      {showModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center border-b p-4">
              <h3 className="text-lg font-medium">
                Conversations for {selectedPeriod.label}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-auto flex-grow">
              {getUsersWithConversationsInPeriod().length > 0 ? (
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-center">Conversations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getUsersWithConversationsInPeriod().map((user, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-gray-50" : ""}
                      >
                        <td className="px-4 py-2 text-sm">{user.name}</td>
                        <td className="px-4 py-2 text-sm text-center">
                          {user.conversationCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500">
                  No conversations found for this period.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
