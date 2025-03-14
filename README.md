# Claude Audit Log Viewer

A React-based data visualization tool for analyzing Claude usage patterns from audit logs.

## Features

- **Summary Cards** showing:

  - Total unique users
  - Total conversations
  - Total projects
  - Total files

- **Tab Navigation**:

  - Overview: Daily active users trend
  - Conversations:
    - Summary metrics for 7D/30D/All-time periods
    - Per-user conversation counts for each period (7D/30D/All-time)
    - User conversation leaderboard with last seen dates
    - Daily conversations trend

- **Tables & Charts**:
  - Sortable HTML tables with Tailwind styling
  - Interactive charts using Recharts
  - Last seen dates for users

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
npm start
```

## Usage

1. Prepare your Claude audit logs in CSV or JSON format
2. Open the application in your browser
3. Upload the audit log files using the file upload interface:
   - You can upload multiple files simultaneously
   - The application is designed to handle three specific JSON files:
     - `conversations.json` - Contains conversation data
     - `projects.json` - Contains project data
     - `users.json` - Contains user data
   - You can also upload a single CSV file with all data combined
4. View and interact with the visualizations and data tables

## Technical Details

The application uses:

- React for the UI framework
- Recharts for data visualizations
- PapaParse for CSV parsing
- Tailwind CSS for styling
- Lodash for data manipulation

The file upload component allows for drag-and-drop functionality and handles the parsing of both CSV and JSON data. Once uploaded, the data is processed to extract meaningful metrics and presented in an interactive dashboard.

## Requirements

Our goal is to produce simple analysis and visualization of usage patterns.
When you upload audit logs files (CSV or JSON), the application will extract:

- Total unique users
- Total conversations
- Total projects
- Total files

And will visualize:

- Daily active users trend
- Conversations metrics for different time periods
- Per-user conversation counts
- User conversation leaderboard with last seen dates
- Daily conversations trend

## License

MIT
