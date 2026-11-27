export interface TaskGridEditPresence {
  indexedRowExists: boolean;
  liveRowExists: boolean;
  columnVisible: boolean;
}

export function shouldCancelTaskGridEdit(presence: TaskGridEditPresence): boolean {
  return !presence.columnVisible || (!presence.indexedRowExists && !presence.liveRowExists);
}

export interface TaskGridCellFocusRequest {
  mode: 'select' | 'edit';
  activeKey: string | null;
  lastRequestedActiveKey: string | null;
}

export function shouldRequestTaskGridCellFocus(request: TaskGridCellFocusRequest): boolean {
  return request.mode === 'select'
    && request.activeKey !== null
    && request.activeKey !== request.lastRequestedActiveKey;
}
