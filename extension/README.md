# GitTask VS Code Extension

GitTask is a code-awareness and navigation sidebar for TODO-style micro-tasks embedded in source code. It is not a task manager or sprint planner; instead, it surfaces code-level tasks and helps you understand their context quickly.

## Features

- **Task discovery**: Scans the workspace for comment-based tasks such as `TODO`, `FIXME`, `HACK`, and structured `@task` comments.
- **Custom `@task` syntax**: Supports structured comments like:

	```ts
	// @task [priority:high] [status:active] [author:alice]
	// Refactor authentication middleware
	```

	The `@task` tag, `priority`, `status`, and `author` fields are syntax highlighted and machine-readable for future backend integrations.

- **Sidebar task view**: Shows all discovered tasks under the **GitTask Tasks** view in the Explorer sidebar, including:
	- Task text
	- File name and line number
	- Task type (TODO / FIXME / HACK / structured)
	- Status (active / done)
	- Assigned developer (if present)

- **Automatic updates**: Keeps the task list up to date as you create, edit, or delete task comments using document change listeners and filesystem watchers.

- **Navigation**: Clicking a task opens the file, jumps to the exact line, and selects the task comment.

- **Filtering & sorting**:
	- Filter by status (active / done)
	- Filter by task type
	- Filter by author
	- Sort by file or priority

- **AI-guided code tours (placeholder)**: For any selected task, run **GitTask: AI-Guided Code Tour** to get a read-only, heuristic tour suggesting:
	- Related symbols near the task
	- A safe reading order
	- Pointers to surrounding context and where to look next

## Usage

1. Open a folder or workspace.
2. Open the **GitTask Tasks** view in the Explorer sidebar.
3. Use the following commands (from the Command Palette or the view):
	 - `GitTask: Refresh Tasks`
	 - `GitTask: Filter by Status`
	 - `GitTask: Filter by Type`
	 - `GitTask: Filter by Author`
	 - `GitTask: Sort Tasks`
	 - `GitTask: AI-Guided Code Tour`

## Non-goals

- No task assignment UI
- No sprint planning or backlog management
- No automatic code edits or fixes
- No personal to-do lists

GitTask focuses purely on code-level task discovery and navigation.
