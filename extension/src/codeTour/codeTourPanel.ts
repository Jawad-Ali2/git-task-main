import * as vscode from "vscode";
import { CodeTour, CodeTourStep } from "./codeTourTypes";

// Manages the WebView panel for displaying AI-guided code tours
export class CodeTourPanel {
  public static currentPanel: CodeTourPanel | undefined;
  private static readonly viewType = "gittask.codeTour";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private currentTour: CodeTour | undefined;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    // Set initial HTML
    this.panel.webview.html = this.getLoadingHtml();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables,
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  // Create or show the code tour panel
  public static createOrShow(extensionUri: vscode.Uri): CodeTourPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel exists, show it
    if (CodeTourPanel.currentPanel) {
      CodeTourPanel.currentPanel.panel.reveal(column);
      return CodeTourPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      CodeTourPanel.viewType,
      "AI Code Tour",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    CodeTourPanel.currentPanel = new CodeTourPanel(panel, extensionUri);
    return CodeTourPanel.currentPanel;
  }

  public showLoading(taskLabel: string): void {
    this.panel.webview.html = this.getLoadingHtml(taskLabel);
  }

  public showTour(tour: CodeTour): void {
    this.currentTour = tour;
    this.panel.webview.html = this.getTourHtml(tour);
  }

  public showError(message: string): void {
    this.panel.webview.html = this.getErrorHtml(message);
  }

  // Handle messages from the webview
  private async handleMessage(message: {
    command: string;
    data?: unknown;
  }): Promise<void> {
    switch (message.command) {
      case "openFile": {
        const data = message.data as { filePath: string; lineNumber?: number };
        await this.openFileAtLocation(data.filePath, data.lineNumber);
        break;
      }
      case "copyToClipboard": {
        const text = message.data as string;
        await vscode.env.clipboard.writeText(text);
        void vscode.window.showInformationMessage("Copied to clipboard!");
        break;
      }
    }
  }

  private async openFileAtLocation(
    relativePath: string,
    lineNumber?: number,
  ): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      const fileUri = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        relativePath,
      );
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      if (lineNumber && lineNumber > 0) {
        const line = lineNumber - 1; // Convert to 0-based
        const range = new vscode.Range(line, 0, line, 0);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Could not open file: ${relativePath}`,
      );
    }
  }

  public dispose(): void {
    CodeTourPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getLoadingHtml(taskLabel?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Code Tour</title>
  <style>
    ${this.getBaseStyles()}
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--vscode-foreground);
      border-top-color: var(--vscode-focusBorder);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading-container">
    <div class="spinner"></div>
    <h2>Generating AI Code Tour...</h2>
    ${taskLabel ? `<p>Analyzing: "${this.escapeHtml(taskLabel)}"</p>` : ""}
    <p class="muted">This may take a few moments</p>
  </div>
</body>
</html>`;
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Code Tour - Error</title>
  <style>
    ${this.getBaseStyles()}
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }
    .error-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .error-message {
      color: var(--vscode-errorForeground);
      max-width: 500px;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">⚠️</div>
    <h2>Unable to Generate Code Tour</h2>
    <p class="error-message">${this.escapeHtml(message)}</p>
  </div>
</body>
</html>`;
  }

  private getTourHtml(tour: CodeTour): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Code Tour</title>
  <style>
    ${this.getBaseStyles()}
    ${this.getTourStyles()}
  </style>
</head>
<body>
  <div class="tour-container">
    <header class="tour-header">
      <div class="tour-type ${tour.taskType}">${tour.taskType.toUpperCase()}</div>
      <h1 class="tour-title">${this.escapeHtml(tour.taskLabel)}</h1>
      <div class="tour-location">
        <a href="#" onclick="openFile('${this.escapeHtml(tour.sourceFilePath)}', ${tour.sourceLineNumber}); return false;">
          📍 ${this.escapeHtml(tour.sourceFilePath)}:${tour.sourceLineNumber}
        </a>
      </div>
      <div class="tour-meta">
        Generated: ${new Date(tour.generatedAt).toLocaleString()}
      </div>
    </header>

    <section class="tour-section">
      <h2>📝 Summary</h2>
      <div class="summary-content">
        ${this.formatMarkdown(tour.summary)}
      </div>
    </section>

    <section class="tour-section">
      <h2>🗺️ Code Tour Steps</h2>
      <div class="steps-container">
        ${tour.steps.map((step) => this.renderStep(step)).join("")}
      </div>
    </section>

    ${
      tour.dependencies.length > 0
        ? `
    <section class="tour-section">
      <h2>📦 Dependencies</h2>
      <ul class="tag-list">
        ${tour.dependencies.map((dep) => `<li class="tag">${this.escapeHtml(dep)}</li>`).join("")}
      </ul>
    </section>
    `
        : ""
    }

    ${
      tour.risks.length > 0
        ? `
    <section class="tour-section risks-section">
      <h2>⚠️ Risks & Considerations</h2>
      <ul class="risks-list">
        ${tour.risks.map((risk) => `<li>${this.escapeHtml(risk)}</li>`).join("")}
      </ul>
    </section>
    `
        : ""
    }

    ${
      tour.suggestedChanges.length > 0
        ? `
    <section class="tour-section suggestions-section">
      <h2>💡 Suggested Changes</h2>
      <ul class="suggestions-list">
        ${tour.suggestedChanges.map((suggestion) => `<li>${this.escapeHtml(suggestion)}</li>`).join("")}
      </ul>
    </section>
    `
        : ""
    }

    <footer class="tour-footer">
      <p class="muted">This tour is cached and will be available for 1 hour.</p>
    </footer>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function openFile(filePath, lineNumber) {
      vscode.postMessage({
        command: 'openFile',
        data: { filePath, lineNumber }
      });
    }

    function copyToClipboard(text) {
      vscode.postMessage({
        command: 'copyToClipboard',
        data: text
      });
    }
  </script>
</body>
</html>`;
  }

  private renderStep(step: CodeTourStep): string {
    const hasLocation = step.filePath && step.lineNumber;
    const locationLink = hasLocation
      ? `<a href="#" onclick="openFile('${this.escapeHtml(step.filePath!)}', ${step.lineNumber}); return false;" class="step-location">
           📂 ${this.escapeHtml(step.filePath!)}:${step.lineNumber}
         </a>`
      : "";

    return `
      <div class="step-card">
        <div class="step-header">
          <span class="step-number">${step.stepNumber}</span>
          <h3 class="step-title">${this.escapeHtml(step.title)}</h3>
        </div>
        <div class="step-content">
          <p class="step-description">${this.escapeHtml(step.description)}</p>
          ${step.symbolName ? `<div class="step-symbol">Symbol: <code>${this.escapeHtml(step.symbolName)}</code></div>` : ""}
          ${step.relevance ? `<div class="step-relevance">${this.escapeHtml(step.relevance)}</div>` : ""}
          ${locationLink}
        </div>
      </div>
    `;
  }

  private getBaseStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        line-height: 1.6;
        padding: 20px;
      }
      a {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      code {
        font-family: var(--vscode-editor-font-family);
        background-color: var(--vscode-textCodeBlock-background);
        padding: 2px 6px;
        border-radius: 3px;
      }
      .muted {
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
      }
    `;
  }

  private getTourStyles(): string {
    return `
      .tour-container {
        max-width: 900px;
        margin: 0 auto;
      }
      .tour-header {
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .tour-type {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .tour-type.todo { background-color: var(--vscode-charts-blue); color: white; }
      .tour-type.fixme { background-color: var(--vscode-charts-red); color: white; }
      .tour-type.hack { background-color: var(--vscode-charts-orange); color: white; }
      .tour-type.structured { background-color: var(--vscode-charts-purple); color: white; }
      .tour-title {
        font-size: 1.5em;
        margin-bottom: 10px;
        color: var(--vscode-foreground);
      }
      .tour-location {
        margin-bottom: 8px;
      }
      .tour-meta {
        color: var(--vscode-descriptionForeground);
        font-size: 0.85em;
      }
      .tour-section {
        margin-bottom: 30px;
      }
      .tour-section h2 {
        font-size: 1.2em;
        margin-bottom: 15px;
        color: var(--vscode-foreground);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .summary-content {
        background-color: var(--vscode-textBlockQuote-background);
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid var(--vscode-textLink-foreground);
      }
      .steps-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      .step-card {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 15px;
        transition: border-color 0.2s;
      }
      .step-card:hover {
        border-color: var(--vscode-focusBorder);
      }
      .step-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 50%;
        font-weight: bold;
        font-size: 0.9em;
        flex-shrink: 0;
      }
      .step-title {
        font-size: 1.05em;
        color: var(--vscode-foreground);
      }
      .step-content {
        padding-left: 40px;
      }
      .step-description {
        margin-bottom: 10px;
      }
      .step-symbol {
        margin-bottom: 8px;
        font-size: 0.9em;
      }
      .step-relevance {
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
        font-style: italic;
        margin-bottom: 8px;
      }
      .step-location {
        display: inline-block;
        font-size: 0.9em;
        padding: 4px 8px;
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 4px;
      }
      .tag-list {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tag {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 0.9em;
      }
      .risks-section {
        background-color: rgba(255, 200, 0, 0.1);
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid var(--vscode-charts-orange);
      }
      .risks-list, .suggestions-list {
        list-style: disc;
        padding-left: 25px;
      }
      .risks-list li, .suggestions-list li {
        margin-bottom: 8px;
      }
      .suggestions-section {
        background-color: rgba(0, 200, 100, 0.1);
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid var(--vscode-charts-green);
      }
      .tour-footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid var(--vscode-panel-border);
        text-align: center;
      }
    `;
  }

  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }

  private formatMarkdown(text: string): string {
    let html = this.escapeHtml(text);

    // Convert **bold** to <strong>
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Convert `code` to <code>
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Convert newlines to <br>
    html = html.replace(/\n/g, "<br>");

    return html;
  }
}
