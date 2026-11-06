# Community versions (round 1)

Base text: `2026-10-forum-post.md`. Each version has its own title and emphasis, so no forum gets the same message twice.

---

## 1. OSArch — category General (post directly)

**Title:** Open Planner Studio: open-source construction scheduler with IFC 4.3 as its native file format

Hi all,

I maintain Open Planner Studio, an open-source (LGPL-3.0) scheduling application for construction, part of the OpenAEC Foundation. It runs in the browser without install or account, and as a desktop app for Windows, macOS and Linux.

I'm looking for people who want to test it on real schedules, and for feedback on the IFC side.

IFC:

- IFC 4.3 is the native project format; there is no separate project file. A schedule is written as IfcWorkPlan/IfcWorkSchedule with IfcTask, IfcTaskTime, IfcRelSequence with IfcLagTime, IfcWorkCalendar and labour/crew/equipment resources.
- Because the files are standard IFC, you can merge a schedule with a building model in tools such as IfcOpenShell or Bonsai; I don't test those tools myself. Linking tasks to building elements (4D) inside the app is not implemented yet.

Scheduling:

- CPM with total/free/interfering float, FS/SS/FF/SF with lag, eight constraint types, near-critical threshold, multiple float paths, LOE tasks.
- Opens P6 `.xer` and P6 XML, MS Project `.mpp` (2010–2021) and MSP XML; exports to P6 XML and MSP XML. `.xer` export is in development.
- Calculation profiles for P6 and MS Project conventions, resource levelling, baselines, progress via an `.xlsx`/`.csv` sheet, eleven reports.

How you can help:

- **Test it** on a real schedule or IFC workflow. The feedback button in the app works without a GitHub account.
- **Send anonymised `.xer` or `.mpp` files** for import testing: https://github.com/OpenAEC-Foundation/open-planner-studio/discussions/71
- **Request features** through the feedback button or in GitHub Discussions.
- **Contribute code** through a pull request.

Browser: https://open-planner-studio.open-aec.com/
Source: https://github.com/OpenAEC-Foundation/open-planner-studio

Thanks,
Ethan de Wit

---

## 2. r/ConstructionManagers (post directly, flair: Technology)

**Title:** Free, open-source tool to open and recalculate P6 .xer and MS Project files without a licence

I maintain Open Planner Studio, a free, open-source (LGPL-3.0) scheduler from the OpenAEC Foundation. Nothing to sell: no paid tier, no account. It runs in the browser or as a desktop app.

The part that may be useful here: when a sub or owner sends you an .xer or .mpp and you don't have P6 or MS Project, you can open it, see the critical path and float, and recalculate. It first shows the dates as the source program saved them, and tells you how many tasks a recalculation would move.

It also does relationships with lag, constraints, baselines, progress through an .xlsx sheet the site team fills in, a resource histogram with levelling, and look-ahead and variance reports.

What it doesn't do: it can't write .mpp or .xer yet (.xer export is in development; P6 XML and MSP XML export work), there is no cost management, and P6 Actual Dates is not supported.

If you try it on a real schedule, I'd like to hear where the dates don't match P6 or MSP. The feedback button in the app works without an account.

Question for this sub: what would a scheduler need before you'd use it next to P6 or MS Project on a job?

Browser: https://open-planner-studio.open-aec.com/

Source: https://github.com/OpenAEC-Foundation/open-planner-studio

---

## 3. Planning Planet — message to the moderators (send first, post only after approval)

**Subject:** Question before posting: free open-source scheduling tool, looking for testers

Hello,

I maintain Open Planner Studio, a free, open-source (LGPL-3.0) scheduling application for construction, developed under the OpenAEC Foundation. There is no paid version, no licence and no account; it runs in the browser and as a desktop app.

It opens P6 `.xer` and P6 XML files and calculates with P6 scheduling conventions. I would like to ask experienced P6 planners to test it on real schedules and report where the results differ from P6.

Before I post, I want to check the forum rules with you, in particular rules 6 and 7. Is a single post introducing the tool and asking for testers allowed, and if so, in which forum? I will post it only once.

The text I would post is below / attached.

Thank you,
Ethan de Wit

*(Attach or paste the text of `2026-10-forum-post.md`.)*

---

## 4. r/bim — message to the moderators (modmail; post only after approval)

**Subject:** Request for approval: introducing an open-source scheduler with native IFC 4.3

Hi mods,

The sidebar asks for approval before a product introduction, so I'm asking first.

I maintain Open Planner Studio, a free, open-source (LGPL-3.0) construction scheduler from the OpenAEC Foundation. It saves schedules natively as IFC 4.3 (IfcWorkSchedule, IfcTask, IfcRelSequence), and opens P6 and MS Project files. There is no paid version.

I'd like to post once to introduce it and ask for testers and feedback on the IFC side. May I, and is there a flair or format you prefer?

Thanks,
Ethan de Wit
