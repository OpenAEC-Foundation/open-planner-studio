# Choosing the progress mode

Goal: decide how the app plans the remaining work of a task that has already started while its predecessor is still running: according to the relation (Retained Logic) or according to what actually happens (Progress Override).

## When you need this

On site, work often runs ahead of the logic. The painter already starts in the rooms that have been plastered, while the plasterer is still busy elsewhere. In the schedule that is, for example, a Finish-Start relation whose successor starts before the predecessor is finished. The app calls that **out-of-sequence**. If the status bar shows *N out-of-sequence relation(s)*, you have such a case, and the progress mode decides how the app plans the remaining work of the successor. What the two modes do, with a worked example, is in [Progress, status date and baseline](docs://uitleg-voortgang).

## Steps

1. Update the progress and set the status date, as described in [Updating progress](docs://howto-voortgang-bijwerken).
2. Go to *Planning › Baselines & progress › Progress mode* and open the list.
3. Choose *Retained Logic* or *Progress Override*.
4. Press **Calculate** (F5), for example through *Planning › Schedule › Calculate*. The choice makes the schedule out of date: the status bar reports *Out of date — recalculate (F5)*. If *Calculate automatically* is on, the app does this itself.

How do you choose?

- **Retained Logic** is the default. The relation stays in force: the remaining work of the successor only starts once the predecessor is finished. Choose this if the order is really fixed, or if you want to plan cautiously.
- **Progress Override** lets reality win. The remaining work of the successor starts on the status date, without waiting for the predecessor. Choose this if the successor really keeps working and the finish date should not depend on a predecessor that is still running.

## Checking the result

- Click the message *N out-of-sequence relation(s)* in the status bar. The *Warnings* panel opens, also reachable through *Planning › Schedule › Warnings*. Every relation is in it with the text *Out of sequence: the successor's progress contradicts the relation*, for example *4.2 Plastering → 4.5 Painting (FS)*.
- Look at the bar of the successor. Under Retained Logic it runs until after the finish of its predecessor. Under Progress Override it finishes earlier. In the example of the explanation that is Tuesday 27 July against Thursday 22 July.

## Pitfalls and what the app does

**No difference.** The mode only has an effect on tasks that have already started while their predecessor is not yet finished. Without such a task nothing changes.

**The message stays.** Progress Override does not solve the out-of-sequence message. The mode decides how the app calculates; the contradiction between relation and progress remains. If the relation is no longer right, change it ([Adding relations](docs://howto-relaties-leggen)).

**It belongs to the project.** The choice is saved with the project file, applies to the whole project and can be undone with Ctrl+Z. A new project is on Retained Logic.

**A P6 file.** If you open a Primavera P6 file (.xer), the app takes the mode from the file. Besides Retained Logic and Progress Override, P6 also has Actual Dates. The app does not know that third mode; such a file calculates as Retained Logic. The import message counts that as *1 P6 scheduling setting used a safe fallback.*

**The calculation profile.** In the Primavera P6 profile Progress Override also works backward, in the late dates and the free float of the predecessor (convention *Progress Override ignores a started successor on the late side too*). In the Open Planner Studio and Microsoft Project profiles that is not so. You find the conventions under *Settings › Project › Project info*, in the block *Calculation profile and options*. In the example of the explanation that backward effect cannot be seen.

## See also

- [Progress, status date and baseline](docs://uitleg-voortgang): the difference between the two modes, with numbers.
- [Updating progress](docs://howto-voortgang-bijwerken): entering the progress the mode works on.
- [Adding relations](docs://howto-relaties-leggen): changing a relation that is no longer right.
