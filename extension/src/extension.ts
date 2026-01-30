// The module 'vscode' contains the VS Code extensibility API
import * as vscode from "vscode";
import { CodeTask } from "./tasks/taskTypes";
import {
  TaskTreeDataProvider,
  TaskTreeItem,
} from "./tasks/taskTreeDataProvider";
import { TaskCompletionProvider } from "./tasks/taskCompletionProvider";

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
      "gittask.aiCodeTour",
      async (task: CodeTask) => {
        await showAiCodeTour(task);
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

async function showAiCodeTour(task: CodeTask): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(task.fileUri);
    const surroundingInfo = getSurroundingContextInfo(document, task.line);

    const steps: string[] = [];
    steps.push(
      `1. Start at ${vscode.workspace.asRelativePath(task.fileUri)}:${task.line + 1} to review the task comment.`,
    );
    if (surroundingInfo.nearestSymbol) {
      steps.push(
        `2. Inspect the nearby symbol "${surroundingInfo.nearestSymbol}" to understand the primary behavior this task affects.`,
      );
    }
    if (surroundingInfo.relatedLinesDescription) {
      steps.push(
        `3. Read the surrounding lines (${surroundingInfo.relatedLinesDescription}) to see how data flows into and out of this area.`,
      );
    }
    steps.push(
      "4. Search the workspace for this symbol or key identifiers from the task comment to find related usages.",
    );
    steps.push(
      "5. Review any tests or spec files that mention these identifiers to understand expected behavior.",
    );

    const message = `AI-guided code tour for task: "${task.label}"

${steps.join("\n")}`;

    await vscode.window.showInformationMessage(message, { modal: true });
  } catch (error) {
    await vscode.window.showErrorMessage(
      "Unable to generate AI-guided code tour for this task.",
    );
  }
}

interface SurroundingContextInfo {
  nearestSymbol?: string;
  relatedLinesDescription?: string;
}

function getSurroundingContextInfo(
  document: vscode.TextDocument,
  line: number,
): SurroundingContextInfo {
  const totalLines = document.lineCount;
  const startLine = Math.max(0, line - 20);
  const endLine = Math.min(totalLines - 1, line + 20);

  let nearestSymbol: string | undefined;
  for (let i = line; i >= startLine; i -= 1) {
    const text = document.lineAt(i).text;
    const symbolMatch = text.match(
      /\b(class|interface|function|async function|const|let|var)\s+([A-Za-z0-9_$]+)/,
    );
    if (symbolMatch) {
      nearestSymbol = symbolMatch[2];
      break;
    }
  }

  const relatedLinesDescription = `${startLine + 1}-${endLine + 1}`;

  return { nearestSymbol, relatedLinesDescription };
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
      const rangeToDelete = new vscode.Range(
        lineToDelete.range.start,
        lineNumber + 1 < document.lineCount
          ? document.lineAt(lineNumber + 1).range.start
          : lineToDelete.range.end,
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
