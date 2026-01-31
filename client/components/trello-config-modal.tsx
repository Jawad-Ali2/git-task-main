'use client';

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTrelloBoards,
  fetchTrelloLists,
  configureTrello,
  TrelloConfig,
} from '@/redux/integrationsSlice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import axios from '@/lib/axios';

interface TrelloConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  currentConfig?: TrelloConfig;
  onConfigured?: () => void;
  repositoryId?: string; // ✅ Add repository ID for board creation
}

export default function TrelloConfigModal({
  open,
  onOpenChange,
  integrationId,
  currentConfig,
  onConfigured,
  repositoryId,
}: TrelloConfigModalProps) {
  const dispatch = useAppDispatch();
  const { trelloBoards, trelloLists, loading } = useAppSelector(
    (state) => state.integrations
  );

  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creatingBoard, setCreatingBoard] = useState(false);
  
  const [selectedBoardId, setSelectedBoardId] = useState(
    currentConfig?.boardId || ''
  );
  const [config, setConfig] = useState<TrelloConfig>({
    boardId: currentConfig?.boardId || '',
    boardName: currentConfig?.boardName || '',
    todoListId: currentConfig?.todoListId || '',
    todoListName: currentConfig?.todoListName || '',
    inProgressListId: currentConfig?.inProgressListId || '',
    inProgressListName: currentConfig?.inProgressListName || '',
    doneListId: currentConfig?.doneListId || '',
    doneListName: currentConfig?.doneListName || '',
    syncEnabled: currentConfig?.syncEnabled ?? true,
    autoCreateCards: currentConfig?.autoCreateCards ?? true,
    autoMoveCards: currentConfig?.autoMoveCards ?? true,
  });

  useEffect(() => {
    if (open) {
      dispatch(fetchTrelloBoards());
    }
  }, [open, dispatch]);

  useEffect(() => {
    if (selectedBoardId) {
      dispatch(fetchTrelloLists(selectedBoardId));
    }
  }, [selectedBoardId, dispatch]);

  const handleBoardChange = (boardId: string) => {
    const board = trelloBoards.find((b) => b.id === boardId);
    setSelectedBoardId(boardId);
    setConfig({
      ...config,
      boardId,
      boardName: board?.name || '',
      // Reset list selections when board changes
      todoListId: '',
      todoListName: '',
      inProgressListId: '',
      inProgressListName: '',
      doneListId: '',
      doneListName: '',
    });
  };

  const handleListChange = (
    type: 'todo' | 'inProgress' | 'done',
    listId: string
  ) => {
    const list = trelloLists.find((l) => l.id === listId);
    if (type === 'todo') {
      setConfig({
        ...config,
        todoListId: listId,
        todoListName: list?.name || '',
      });
    } else if (type === 'inProgress') {
      setConfig({
        ...config,
        inProgressListId: listId,
        inProgressListName: list?.name || '',
      });
    } else {
      setConfig({
        ...config,
        doneListId: listId,
        doneListName: list?.name || '',
      });
    }
  };

  const handleSave = async () => {
    if (!config.boardId || !config.todoListId) {
      toast.error('Please select a board and at least a TODO list');
      return;
    }

    try {
      await dispatch(
        configureTrello({
          id: integrationId,
          config,
        })
      ).unwrap();
      toast.success('Trello configuration saved successfully!');
      
      // ✅ Call optional callback BEFORE closing modal to prevent race condition
      if (onConfigured) {
        onConfigured();
      }
      
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    }
  };

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      toast.error('Please enter a board name');
      return;
    }

    setCreatingBoard(true);
    try {
      const response = await axios.post('/integrations/trello/boards/create', {
        name: newBoardName.trim(),
        description: `Board for ${newBoardName}`,
        repositoryId: repositoryId,
      });

      const { board, lists } = response.data;

      toast.success(`Board "${board.name}" created successfully!`);

      // Auto-configure the newly created board with default lists
      setConfig({
        ...config,
        boardId: board.id,
        boardName: board.name,
        todoListId: lists.todo.id,
        todoListName: lists.todo.name,
        inProgressListId: lists.inProgress.id,
        inProgressListName: lists.inProgress.name,
        doneListId: lists.done.id,
        doneListName: lists.done.name,
      });

      setSelectedBoardId(board.id);
      setShowCreateBoard(false);
      setNewBoardName('');

      // Refresh boards list
      dispatch(fetchTrelloBoards());
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create board');
    } finally {
      setCreatingBoard(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Trello Integration</DialogTitle>
          <DialogDescription>
            Select your Trello board and map lists to task statuses. This
            determines where cards will be created and moved as tasks progress.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Board Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="board">Trello Board *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateBoard(!showCreateBoard)}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create New Board
              </Button>
            </div>

            {/* Create Board Form */}
            {showCreateBoard && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                <Label htmlFor="newBoardName">New Board Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="newBoardName"
                    placeholder="Enter board name..."
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateBoard();
                      }
                    }}
                  />
                  <Button
                    onClick={handleCreateBoard}
                    disabled={creatingBoard || !newBoardName.trim()}
                    size="sm"
                  >
                    {creatingBoard && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This will create a new board with default lists: To Do, In Progress, and Done
                </p>
              </div>
            )}

            <Select value={selectedBoardId} onValueChange={handleBoardChange}>
              <SelectTrigger id="board">
                <SelectValue placeholder="Select a board" />
              </SelectTrigger>
              <SelectContent>
                {trelloBoards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {trelloBoards.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                No boards found. Create a new board using the button above.
              </p>
            )}
          </div>

          {selectedBoardId && trelloLists.length > 0 && (
            <>
              {/* List Mappings */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="todoList">
                    TODO List *
                    <span className="text-muted-foreground text-xs ml-2">
                      (for new/open tasks)
                    </span>
                  </Label>
                  <Select
                    value={config.todoListId}
                    onValueChange={(value) => handleListChange('todo', value)}
                  >
                    <SelectTrigger id="todoList">
                      <SelectValue placeholder="Select TODO list" />
                    </SelectTrigger>
                    <SelectContent>
                      {trelloLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inProgressList">
                    In Progress List
                    <span className="text-muted-foreground text-xs ml-2">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={config.inProgressListId}
                    onValueChange={(value) =>
                      handleListChange('inProgress', value)
                    }
                  >
                    <SelectTrigger id="inProgressList">
                      <SelectValue placeholder="Select In Progress list" />
                    </SelectTrigger>
                    <SelectContent>
                      {trelloLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doneList">
                    Done List
                    <span className="text-muted-foreground text-xs ml-2">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={config.doneListId}
                    onValueChange={(value) => handleListChange('done', value)}
                  >
                    <SelectTrigger id="doneList">
                      <SelectValue placeholder="Select Done list" />
                    </SelectTrigger>
                    <SelectContent>
                      {trelloLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sync Options */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Sync Options</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Sync</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow syncing tasks with Trello
                    </p>
                  </div>
                  <Switch
                    checked={config.syncEnabled}
                    onCheckedChange={(checked: boolean) =>
                      setConfig({ ...config, syncEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Create Cards</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create Trello cards for new TODOs
                    </p>
                  </div>
                  <Switch
                    checked={config.autoCreateCards}
                    onCheckedChange={(checked: boolean) =>
                      setConfig({ ...config, autoCreateCards: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Move Cards</Label>
                    <p className="text-sm text-muted-foreground">
                      Update task status when cards are moved in Trello
                    </p>
                  </div>
                  <Switch
                    checked={config.autoMoveCards}
                    onCheckedChange={(checked: boolean) =>
                      setConfig({ ...config, autoMoveCards: checked })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {selectedBoardId && trelloLists.length === 0 && loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !config.boardId || !config.todoListId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
