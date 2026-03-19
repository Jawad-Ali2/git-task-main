// The module 'vscode' contains the VS Code extensibility API
import * as vscode from "vscode";
import { CodeTask } from "./tasks/taskTypes";
import {
  TaskTreeDataProvider,
  TaskTreeItem,
} from "./tasks/taskTreeDataProvider";
import { TaskCompletionProvider } from "./tasks/taskCompletionProvider";
import {
  CodeTourService,
  CodeTourPanel,
  extractTaskContext,
} from "./codeTour";

// This method is called when your extension is activated
// Your extension is activated the first time its view or a command is used.
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const taskTreeDataProvider = new TaskTreeDataProvider();
  const tasksView = vscode.window.createTreeView("gittask.tasksView", {
    treeDataProvider: taskTreeDataProvider,
  });
  context.subscriptions.push(tasksView);

  // Initialize the Code Tour service
  const codeTourService = new CodeTourService(context);

  // Register completion provider for @task snippets
  const completionProvider = new TaskCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: "file" },
      completionProvider,
      "@",
      "t", // Trigger on @ and t for better completion experience
    ),
  );

  // Initial workspace scan
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    await taskTreeDataProvider.scanWorkspace();
  }

  // React to text document changes
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      void taskTreeDataProvider.updateTasksForDocument(document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      void taskTreeDataProvider.updateTasksForDocument(event.document);
    }),
    vscode.workspace.onDidDeleteFiles((event) => {
      taskTreeDataProvider.removeTasksForUris(event.files);
    }),
  );

  // File system watcher for external changes
  const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  watcher.onDidCreate((uri) => {
    void taskTreeDataProvider.updateTasksForUri(uri);
  });
  watcher.onDidChange((uri) => {
    void taskTreeDataProvider.updateTasksForUri(uri);
  });
  watcher.onDidDelete((uri) => {
    taskTreeDataProvider.removeTasksForUris([uri]);
  });
  context.subscriptions.push(watcher);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("gittask.refreshTasks", async () => {
      await taskTreeDataProvider.scanWorkspace();
    }),
    vscode.commands.registerCommand(
      "gittask.openTask",
      async (task: CodeTask) => {
        await openTaskInEditor(task);
      },
    ),
    vscode.commands.registerCommand("gittask.filterByStatus", async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Done", value: "done" },
        ],
        {
          placeHolder: "Filter GitTask tasks by status",
        },
      );
      if (!pick) {
        return;
      }
      taskTreeDataProvider.setStatusFilter(pick.value as any);
    }),
    vscode.commands.registerCommand("gittask.filterByType", async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: "All", value: "all" },
          { label: "TODO", value: "todo" },
          { label: "FIXME", value: "fixme" },
          { label: "HACK", value: "hack" },
          { label: "NOTE", value: "note" },
          { label: "Structured (@task)", value: "structured" },
        ],
        {
          placeHolder: "Filter GitTask tasks by type",
        },
      );
      if (!pick) {
        return;
      }
      taskTreeDataProvider.setTypeFilter(pick.value as any);
    }),
    vscode.commands.registerCommand("gittask.filterByAuthor", async () => {
      const allTasks = taskTreeDataProvider.getAllTasks();
      const authors = Array.from(
        new Set(
          allTasks
            .map((t) => t.author)
            .filter(
              (a): a is string => typeof a === "string" && a.trim().length > 0,
            ),
        ),
      );

      const options = authors.map((a) => ({ label: a }));
      options.unshift({ label: "All (no author filter)" });

      const pick = await vscode.window.showQuickPick(options, {
        placeHolder: "Filter GitTask tasks by author",
      });
      if (!pick) {
        return;
      }
      if (pick.label.startsWith("All")) {
        taskTreeDataProvider.setAuthorFilter(undefined);
      } else {
        taskTreeDataProvider.setAuthorFilter(pick.label);
      }
    }),
    vscode.commands.registerCommand("gittask.sortTasks", async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: "By file", value: "file" },
          { label: "By priority", value: "priority" },
          { label: "None (default order)", value: "none" },
        ],
        {
          placeHolder: "Sort GitTask tasks",
        },
      );
      if (!pick) {
        return;
      }
      taskTreeDataProvider.setSortBy(pick.value as any);
    }),
    vscode.commands.registerCommand(
      "gittask.startCodeTour",
      async (item: CodeTask | TaskTreeItem) => {
        const task: CodeTask = item instanceof TaskTreeItem ? item.task : item;
        await startAiCodeTour(task, codeTourService, context);
      },
    ),
    vscode.commands.registerCommand(
      "gittask.markTaskAsResolved",
      async (item: CodeTask | TaskTreeItem) => {
        await markTaskAsResolved(item, context);
      },
    ),
    vscode.commands.registerCommand("gittask.resetPreferences", async () => {
      await context.workspaceState.update(
        "gittask.dontShowResolveConfirmation",
        false,
      );
      await vscode.window.showInformationMessage(
        "GitTask: Preferences have been reset.",
      );
    }),
  );
}

// This method is called when your extension is deactivated
export function deactivate(): void {
  // Nothing to clean up explicitly; disposables are managed via context.subscriptions.
}

async function openTaskInEditor(task: CodeTask): Promise<void> {
  const document = await vscode.workspace.openTextDocument(task.fileUri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
  });

  editor.selection = new vscode.Selection(task.range.start, task.range.end);
  editor.revealRange(task.range, vscode.TextEditorRevealType.InCenter);
}

/**
 * Start an AI-guided code tour for a task
 * This is the main entry point for the code tour feature
 */
async function startAiCodeTour(
  task: CodeTask,
  codeTourService: CodeTourService,
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    // Create or show the panel
    const panel = CodeTourPanel.createOrShow(context.extensionUri);
    panel.showLoading(task.label);

    // Open the document and extract context
    const document = await vscode.workspace.openTextDocument(task.fileUri);
    const taskContext = await extractTaskContext(task, document);

    // Generate or retrieve the code tour
    const tour = await codeTourService.getCodeTour(taskContext);

    // Display the tour
    panel.showTour(tour);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Show error in panel if it exists
    if (CodeTourPanel.currentPanel) {
      CodeTourPanel.currentPanel.showError(errorMessage);
    } else {
      await vscode.window.showErrorMessage(
        `Unable to generate AI-guided code tour: ${errorMessage}`,
      );
    }
  }
}

async function markTaskAsResolved(
  item: CodeTask | TaskTreeItem,
  context: vscode.ExtensionContext,
): Promise<void> {
  // Normalize: commands from the view context menu pass TaskTreeItem, while
  // programmatic calls can pass CodeTask directly.
  const task: CodeTask = item instanceof TaskTreeItem ? item.task : item;
  const DONT_SHOW_AGAIN_KEY = "gittask.dontShowResolveConfirmation";
  const dontShowAgain = context.workspaceState.get<boolean>(
    DONT_SHOW_AGAIN_KEY,
    false,
  );

  let shouldDelete = true;

  if (!dontShowAgain) {
    const relativePath = vscode.workspace.asRelativePath(task.fileUri);
    const message = `Mark this task as resolved?\n\n"${task.label}"\n\nThis will permanently remove the comment line from ${relativePath}:${task.line + 1}.`;
    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      "✅ Resolve (delete comment)",
      "✅ Always resolve without confirming",
    );

    if (!result) {
      shouldDelete = false;
    } else if (result === "✅ Always resolve without confirming") {
      await context.workspaceState.update(DONT_SHOW_AGAIN_KEY, true);
      shouldDelete = true;
    } else if (result === "✅ Resolve (delete comment)") {
      shouldDelete = true;
    }
  }

  if (shouldDelete) {
    try {
      const document = await vscode.workspace.openTextDocument(task.fileUri);
      const edit = new vscode.WorkspaceEdit();

      // Delete the entire line including the newline
      // Use task.line directly as it's always present and is 0-based
      const lineNumber = task.line;
      const lineToDelete = document.lineAt(lineNumber);
      let endLine = lineNumber + 1;

      // For structured comments, check if the next line is part of the task description
      if (task.type === 'structured' && lineNumber + 1 < document.lineCount) {
        const nextLine = document.lineAt(lineNumber + 1);
        const nextLineText = nextLine.text.trim();
        
        // Check if next line is a comment (starts with //, #, or --)
        // and doesn't start with @task (which would be a new task)
        if (
          (nextLineText.startsWith('//') || 
           nextLineText.startsWith('#') || 
           nextLineText.startsWith('--')) &&
          !nextLineText.substring(nextLineText.search(/[/#-]/) + nextLineText.match(/[/#-]+/)![0].length).trim().startsWith('@task')
        ) {
          endLine = lineNumber + 2;
        }
      }

      const rangeToDelete = new vscode.Range(
        lineToDelete.range.start,
        endLine < document.lineCount
          ? document.lineAt(endLine).range.start
          : document.lineAt(endLine - 1).range.end,
      );

      edit.delete(task.fileUri, rangeToDelete);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        await vscode.window.showInformationMessage(
          "Task marked as resolved and removed.",
        );
        // The document change listener will automatically update the task list
      } else {
        await vscode.window.showErrorMessage("Failed to delete task comment.");
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Error resolving task: ${error}`);
    }
  }
}
