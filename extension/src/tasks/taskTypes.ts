import * as vscode from 'vscode';

export type TaskStatus = 'active' | 'in-progress' | 'done';

export type TaskType = 'todo' | 'fixme' | 'hack' | 'structured';

export interface CodeTask {
	readonly id: string;
	readonly label: string;
	readonly type: TaskType;
	readonly status: TaskStatus;
	readonly priority?: string;
	readonly author?: string;
	readonly fileUri: vscode.Uri;
	readonly line: number;
	readonly range: vscode.Range;
	readonly source: 'comment' | 'structured';
	readonly createdDate?: Date;
}
