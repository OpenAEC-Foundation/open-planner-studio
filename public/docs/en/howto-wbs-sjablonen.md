# Saving and inserting WBS templates

Goal: save a phase with its subtasks and their relations as a template, and insert it again later in the same or another project.

## When you need this

You keep planning the same kind of work: every house has a foundation with groundwork, reinforcement, pouring and curing. Instead of creating those tasks over and over and linking them together, you save the phase once as a **template**. A template is a branch of your WBS: one task with everything that hangs under it.

## Steps

### Saving a branch as a template

1. Build the branch the way you want to reuse it: a summary task with subtasks and the relations between them.
2. Right-click that summary task and choose *Save branch as template*. This menu item only appears on tasks with subtasks.

The app reports *Branch saved as template 'Foundation'*. The app does not ask for a name: the template is named after the top task of the branch.

### Inserting a template

1. Select the task the template should go under, or select nothing.
2. Choose *Planning › Structure › Templates*. The list shows each template's name and, for example, *4 tasks, 2 relations*.
3. Click the template.

If a task is selected, the template goes in as the last subtask under that task. That task becomes a summary task as a result. If several tasks are selected, the one you clicked first counts. If nothing is selected, the branch goes at the bottom of the list, at the top level. The inserted branch is selected afterwards.

All inserted tasks sit on the project start and the schedule is out of date. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*, and the dates follow from the relations. Inserting is one step for *Undo*. Saving or deleting a template is not part of it.

### Deleting a template

Open *Planning › Structure › Templates* and click the small bin to the right of the template (*Delete template*). The app does not ask for confirmation.

### What is in a template

For each task, a template keeps the name, the description, the task type, whether it is a milestone, and the duration in days. Of the relations it keeps those between two tasks inside the branch, with type and lag.

Everything else stays behind: dates, progress and actual dates, resource assignments, codes and custom fields (see [Codes and custom fields](docs://howto-codes-en-velden)), the calendar, constraints and deadlines, the priority, a custom task type, for a milestone the kind and the tick *Mandatory (contractual)*, and relations with tasks outside the branch. After inserting you fill those in again: assignments, codes, calendar and constraints are empty, and all tasks start on the project start.

A task that was in hours comes back as a day task, with its duration converted to a fraction of a work day. A task of 5 hours with a work day of 8 hours becomes 0.625 day.

## Pitfalls and what the app does

**Templates do not belong to the project.** The app keeps them in the app's storage on this device, not in the project file. A colleague who opens your file does not see your templates. In the browser version a template belongs to that browser. So if your templates matter, keep them somewhere else as well: put them in a project that you save as a file.

**The same name can occur more than once.** If you save the branch twice, the list holds two templates with the same name. The app overwrites nothing.

**The duration of the top task does not count.** A summary task gets its duration from its subtasks, as soon as you use Calculate.

**A task with resource assignments as the target.** If you select a task with assignments that has no subtasks yet and insert a template under it, the app refuses. The task would become a summary task, and that carries no assignments. The top task of a template has subtasks itself, so the assignments have nowhere to go. The app tells you and changes nothing. Then choose another task, or nothing, as the place. A milestone that receives a template loses its milestone flag, with a message.

**An invalid relation in the template.** If a relation in the template is not allowed, for example a task to its own phase, or it already exists, the app skips it and tells you how many relations were skipped.

## See also

- [Adjusting the structure](docs://howto-structuur-aanpassen): move or indent the inserted branch.
- [Adding relations](docs://howto-relaties-leggen): create relations inside a branch yourself before you save it.
- [Critical path and float](docs://uitleg-kritiek-pad): what happens to the inserted branch after Calculate.
