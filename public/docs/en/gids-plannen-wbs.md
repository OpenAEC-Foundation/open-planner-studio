# Planning & WBS

**PLACEHOLDER CONTENT (wave 1).** This is also a test article for the help viewer, not a real
guide. The real content (WBS hierarchy, summary tasks, milestone kinds) arrives in wave 3
(layer-2 cluster A, see the binding design document).

## What will go here later

This guide will normally describe how to build a task structure: phasing, **summary tasks**, and
the three milestone kinds (start/finish/interim). For now the page only contains representative
formatting to exercise the other side of the viewer — specifically navigation between two
articles.

### Key concepts (placeholder)

- WBS code — hierarchical number per task
- Indent/outdent — move a task deeper or shallower in the tree
- Milestone — a zero-duration task marking a moment in time

### Steps (placeholder)

1. Create the main phases as summary tasks
2. Add the underlying tasks per phase using `indentTasks()`
3. Mark hand-over points as a milestone

A short paragraph with *italic* emphasis and a bit of `inline code` (`outdentTasks()`), followed
by an illustrative code block:

```
outdentTasks(["task-1", "task-2"]);
```

## References

Back to [Quick start](docs://quick-start) to confirm the whole chain (manifest → fetch → render →
internal link) works in both directions.

See this structure in practice in the
[Renovation & Extension Single-Family Home](examples://showcase-verbouwing-eengezinswoning.ifc)
example.

![Screenshot: WBS tree structure in the task table (PLACEHOLDER, becomes a real screenshot in
wave 3)](screenshots/placeholder-wbs.png)
