# Adjusting table columns

Goal: choose which columns you see in the task table, in which order and how wide.

## When you need this

In the meeting you want to see the deadline and the total float next to every task. The site manager only wants the start and finish next to the name. Or a column is so narrow that its header is cut off. The task table consists of columns you choose yourself: there are dozens, from *Task name* and *Duration* to *Deadline*, *Free float* and *Assigned resources*.

There are two task tables, each with its own columns:

- The **task table next to the Gantt** is to the left of the timeline on, among others, the *Home*, *Planning* and *View* tabs. By default it has *WBS*, *Task name* and *Duration*, so there is room left for the timeline.
- The **table on the Table tab** has the whole workspace. By default it has *WBS*, *Task name*, *Duration*, *Start*, *Finish*, *Task type*, *Critical*, *Total float* and *Progress*, plus a column per activity code and custom field of the project.

A change to one table does not change the other.

## Steps

### Adding a column

1. Click the plus (**+**) at the right of the table header. On the *Table* tab you can also use *Table › Columns › Columns…*. The *Choose column* window opens.
2. Find the column. At the top, if you have chosen columns before, is *Recently used*. Type part of the name at *Search*, for example *dead* for *Deadline*, or open a category: *Task*, *Planning*, *Constraints*, *Relations*, *Resources*, *Progress*, *Calculated*, *Baseline*, *Custom* or *Technical*.
3. Click the column. It goes at the end of the table and the window closes.

A column that is already in the table is grey and cannot be chosen.

### Removing a column

Click the minus sign in the column header (*Remove: Deadline*). Or right-click the header and choose *Remove: Deadline*. With Ctrl+Z you get the column back, or you choose it again with the plus.

### Adjusting the width

Drag the edge at the right of the column header to the left or right. Double-click that edge, or choose *Auto fit* in the menu of the header (right mouse button), to make the column wide enough for its content, up to a maximum of 480 pixels. If the edge has focus, the arrow keys widen or narrow it step by step.

### Pinning columns

Right-click the header and choose *Pin*. Pinned columns jump to the front and stay on the left when you scroll horizontally. That works as long as together they are not wider than the window. *Unpin* puts them back in the row.

### Changing the order

Drag a column header to another place. A pinned column you move among the pinned columns, an ordinary column among the ordinary columns.

### Back to the default

Open the *Choose column* window and click *Reset to default* at the bottom. The button is grey if the columns already are the default. For the table on the *Table* tab, a column for every activity code and custom field of the project is added as well, even if you had removed those earlier. Those columns belong to the project the code or field is in. You can read about those codes and fields in [Codes and custom fields](docs://howto-codes-en-velden).

## Pitfalls and what the app does

**The header is cut off.** A narrow column cuts off its name, for example *Total Float* to *Tot…*. Double-click the edge of the header to fit the column.

**You adjust the wrong table.** The columns of the task table next to the Gantt and those of the *Table* tab are separate. If you are on *View* or *Home*, you adjust the table next to the Gantt. The plus on the *Table* tab adjusts the large table.

**A layout puts columns back.** If a layout has the *Columns* part ticked, a click on the layout button puts the columns of the task table next to the Gantt back to the saved state. The table on the *Table* tab is left alone. See [Creating and using a layout](docs://howto-layouts-gebruiken).

**Columns are on your device, not in the project.** The app keeps your column choice for all your projects on this device and does not store it in the project file. It also does not make the project "modified". You can undo every column change with *Undo* (Ctrl+Z); the steps are called, for example, *Add column Deadline* and *Resize column Task name*.

## See also

- [Creating and using a layout](docs://howto-layouts-gebruiken): putting columns on a button together with a filter or sorting.
- [Codes and custom fields](docs://howto-codes-en-velden): creating your own columns that you can choose here.
