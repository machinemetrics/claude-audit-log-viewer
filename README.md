# Claude Audit Log Viewer

A React-based data visualization tool for analyzing Claude usage patterns from audit logs.

## Features

- **Summary Cards** showing:

  - Total unique users
  - Total conversations
  - Total projects
  - Total documents

- **Tab Navigation**:

  - Overview:
    - Daily active users trend
    - Weekly active users with bar chart visualization
    - User metrics for 7D/30D/All-time periods
  - Conversations:
    - Summary metrics for 7D/30D/All-time periods
    - Per-user conversation counts for each period (7D/30D/All-time)
    - User conversation leaderboard with last seen dates
    - Daily conversations trend
    - Weekly conversations bar chart with consistent date bucketing
    - Interactive click functionality to view users with conversations in a specific period
  - Projects:
    - Project metrics for 7D/30D/All-time periods
    - Projects with conversation counts
    - Project list with document counts, creator info, and access status
    - Top project creators leaderboard
  - Users:
    - User information with activity counts and last seen dates

- **Tables & Charts**:
  - Sortable HTML tables with Tailwind styling
  - Interactive charts using Recharts
  - Consistent week bucketing for weekly metrics
  - Interactive chart drill-down for detailed analysis
  - Bar and line charts for different visualization needs

## Installation

1. Clone the repository:

```
git clone https://github.com/yourusername/claude-audit-log-viewer.git
cd claude-audit-log-viewer
```

2. Install dependencies:

```
npm install
```

3. Start the development server:

```
npm run dev
```

## Usage

1. Prepare your Claude audit logs in JSON format
2. Open the application in your browser
3. Upload the audit log files using the file upload interface:
   - You can upload multiple files simultaneously
   - The application is designed to handle three specific JSON files:
     - `conversations.json` - Contains conversation data
     - `projects.json` - Contains project data
     - `users.json` - Contains user data
   - You can also upload a zip file containing multiple JSON files
4. View and interact with the visualizations and data tables
5. Click on chart elements to see detailed breakdowns of user activity in specific time periods

## Technical Details

The application uses:

- React for the UI framework
- Vite for fast development and building
- Recharts for data visualizations
- JSZip for handling zip file uploads
- Tailwind CSS for styling
- Lodash for data manipulation

The file upload component allows for drag-and-drop functionality and handles the parsing of JSON data, including from zip archives. Once uploaded, the data is processed to extract meaningful metrics and presented in an interactive dashboard.

## Data Processing Highlights

- **Consistent Week Calculations**: Weekly metrics are calculated using a consistent approach, ensuring that weeks start on Sunday and end on Saturday, with proper date range formatting.
- **Unique User Tracking**: Uses unique identifiers to accurately track users across different data sources.
- **Project-Conversation Relationships**: Analyzes relationships between projects and conversations to provide insights on project usage.
- **Document Counting**: Accurately counts documents associated with projects.
- **Interactive Period Analysis**: Allows drilling down into specific time periods (day or week) to analyze user conversation patterns.

## Recent Changes

- Added consistent week bucketing for all weekly metrics
- Changed Weekly Active Users display from line chart to bar chart
- Enhanced tooltips to show full date ranges and metrics
- Improved user experience with interactive click functionality on charts
- Added document count tracking for projects
- Implemented support for zip file uploads
- Added detailed project creator information
- Enhanced error handling and data processing reliability

## License

MIT
