export interface TaskGridEditPresence {
  indexedRowExists: boolean;
  liveRowExists: boolean;
  columnVisible: boolean;
}

/**
 * Een net ingevoegde rij staat al synchroon in de Zustand-state, maar React kan nog één render de
 * oude gememoiseerde rowIndex voeren. Die overgang is geen verwijdering en mag de zojuist geopende
 * editor niet annuleren. Een echt verdwenen rij of kolom blijft de edit wel direct beëindigen.
 */
export function shouldCancelTaskGridEdit(presence: TaskGridEditPresence): boolean {
  return !presence.columnVisible || (!presence.indexedRowExists && !presence.liveRowExists);
}

export interface TaskGridCellFocusRequest {
  mode: 'select' | 'edit';
  activeKey: string | null;
  lastRequestedActiveKey: string | null;
}

/**
 * Een actieve cel mag alleen in selectiemodus DOM-focus opeisen. Bij Insert veranderen actieve cel
 * en editmodus in dezelfde render; een uitgestelde celfocus zou anders het zojuist gefocuste
 * invoerveld weer beroven. De editor zet bij commit of annuleren zelf de focus terug op een cel.
 */
export function shouldRequestTaskGridCellFocus(request: TaskGridCellFocusRequest): boolean {
  return request.mode === 'select'
    && request.activeKey !== null
    && request.activeKey !== request.lastRequestedActiveKey;
}
