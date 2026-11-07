import type { LucideIcon } from 'lucide-react';
import {
  Boxes, CheckCircle2, CircleCheck, CircleMinus, ClipboardCheck, Clock, FilePlus2, GitBranch, LifeBuoy,
  OctagonAlert, PackageOpen, ShieldAlert,
} from 'lucide-react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowLeft, ArrowLeftRight, ArrowLeftToLine,
  ArrowRight, ArrowRightToLine, ArrowUp, ArrowUpDown, ArrowUpFromLine, ArrowUpRight, BarChart3,
  BookOpen, Building2, Calendar, CalendarClock, CalendarDays, CalendarRange, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Circle,
  CircleDot, CircleHelp, Columns3, Compass, Copy, DatabaseBackup, Diamond,
  Download, Ellipsis, Eraser, ExternalLink, Eye, EyeOff, FileArchive,
  FileCode, FileDown, FileText, FileType, FileUp, Filter, Flag,
  FolderOpen, GanttChartSquare, Gauge, GitCompareArrows, Globe, GraduationCap, HardDrive,
  HardHat, Hash, History, IndentDecrease, IndentIncrease, Info, Keyboard,
  Layers, LayoutGrid, LayoutTemplate, Library, Link, Link2, ListOrdered,
  ListTree, Lock, Map, Maximize2, Menu, Milestone, Minimize2,
  Minus, MoveHorizontal, Palette, PanelRight, PanelRightClose, Pause, Pen,
  Pencil, Play, Plug, Plus, Printer, Puzzle, Redo2,
  RefreshCw, RotateCcw, RotateCw, Route, Save, SaveAll, Scale,
  Scissors, Search, Settings, Spline, SplitSquareHorizontal, Square, Star,
  Tags, Terminal, Trash2, TrendingUp, Truck, Type, Undo2,
  Unlink2, Unlock, Upload, UserPlus, Users, Wrench, X,
  Zap, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { IconId } from './b2/icons.generated';

// Oude vormen uit `git diff cafbd94f8^1 cafbd94f8 -- src` (#765).
// Bronregels verwijzen naar cafbd94f8^1. Elk oud/nieuw paar is daar nagelopen.
// Bij samengevoegde ids staat de gekozen oude vorm voorop, daarna de andere oude vormen.
// Drie ids hadden geen Lucide-tegenhanger; hun keuze staat bij de tabelregel.
// `satisfies` en check-icon-family.ts weigeren ontbrekende ids.
export const LUCIDE_ICONS = {
  'activity.clear': Trash2, // src/components/panels/AIActivityPanel.tsx:105
  'ai.bridge-start': Play, // src/components/ribbon/ai/AiServerGroup.tsx:64
  'ai.bridge-stop': Square, // src/components/ribbon/ai/AiServerGroup.tsx:64
  'ai.connection-details': Plug, // src/components/ribbon/ai/AiConnectionGroup.tsx:210
  'ai.connection-menu': Plug, // src/components/ribbon/ai/AiConnectionGroup.tsx:195
  'ai.pause': Pause, // src/components/ribbon/ai/AiSafetyGroup.tsx:94
  'ai.read-only-off': Unlock, // src/components/ribbon/ai/AiSafetyGroup.tsx:103
  'ai.read-only-toggle': Lock, // src/components/ribbon/ai/AiSafetyGroup.tsx:103
  'ai.resume': Play, // src/components/ribbon/ai/AiSafetyGroup.tsx:94
  'assignment.hours-distribution': BarChart3, // src/components/task-sections/TaskAssignmentsSection.tsx:263
  'backup.auto': DatabaseBackup, // src/components/ribbon/ai/AiSafetyGroup.tsx:115
  'backup.create': Save, // src/components/ribbon/ai/AiSafetyGroup.tsx:123
  'backup.folder': FolderOpen, // src/components/ribbon/ai/AiSafetyGroup.tsx:131
  'backup.recover': RotateCcw, // src/components/dialogs/RecoveryDialog.tsx:121
  'calendar.copy-workdays': Copy, // src/components/dialogs/WorkTimeEditor.tsx:117
  'calendar.duplicate': Copy, // src/components/dialogs/CalendarDialog.tsx:234
  'calendar.edit': Pencil, // src/components/panels/ResourcePanel.tsx:945
  'calendar.holiday-add': Plus, // src/components/dialogs/CalendarForm.tsx:819
  'calendar.manage': Calendar, // src/components/layout/Ribbon/ribbonConfig.tsx:177
  'calendar.new': Plus, // src/components/dialogs/CalendarDialog.tsx:231
  'calendar.promote': ArrowUpFromLine, // src/components/backstage/LibrarySection.tsx:188
  'calendar.promote-menu': Plus, // src/components/backstage/LibrarySection.tsx:172
  'calendar.work-band-add': Plus, // src/components/dialogs/WorkTimeEditor.tsx:112
  'capture.annotate': Pencil, // src/components/dialogs/ScreenshotAnnotator.tsx:457
  'capture.clear-annotations': Trash2, // src/components/dialogs/ScreenshotAnnotator.tsx:548
  'capture.mask': EyeOff, // src/components/dialogs/ScreenshotAnnotator.tsx:502
  'company.default': Star, // src/components/backstage/LibrarySection.tsx:139
  'company.default-status': Star, // src/components/backstage/LibrarySection.tsx:121
  'company.library': Building2, // src/components/backstage/Backstage.tsx:140; ook Library (src/components/dialogs/JustUpdatedDialog.tsx:14)
  'company.new': Plus, // src/components/backstage/LibrarySection.tsx:113
  'credential.hide': EyeOff, // src/components/dialogs/AiConnectionDetailsDialog.tsx:108
  'credential.regenerate': RefreshCw, // src/components/ribbon/ai/AiConnectionGroup.tsx:155
  'credential.show': Eye, // src/components/dialogs/AiConnectionDetailsDialog.tsx:108
  'data.chart': BarChart3, // src/components/layout/Ribbon/ribbonConfig.tsx:586
  'diagnostics.benchmark': Gauge, // src/components/dialogs/BenchmarkDialog.tsx:96
  'diagnostics.run-benchmark': Play, // src/components/dialogs/BenchmarkDialog.tsx:169
  'document.close': X, // src/components/backstage/Backstage.tsx:161
  'documents.new-or-open': Plus, // src/components/layout/DocumentChrome/DocumentTabBar.tsx:230
  'documents.overview': Menu, // src/components/layout/DocumentChrome/DocumentTabBar.tsx:173; ook LayoutGrid (src/components/layout/DocumentChrome/ProjectRail.tsx:19)
  'draw.arrow': ArrowUpRight, // src/components/dialogs/ScreenshotAnnotator.tsx:486
  'draw.freehand': Pen, // src/components/dialogs/ScreenshotAnnotator.tsx:509
  'draw.rectangle': Square, // src/components/dialogs/ScreenshotAnnotator.tsx:493
  'draw.text': Type, // src/components/dialogs/ScreenshotAnnotator.tsx:516
  'edit.copy': Copy, // src/components/common/PromptBlock.tsx:27
  'edit.delete': Trash2, // src/components/backstage/LibrarySection.tsx:152
  'edit.redo': Redo2, // src/components/layout/Ribbon/ribbonConfig.tsx:291
  'edit.undo': Undo2, // src/components/dialogs/ScreenshotAnnotator.tsx:540
  'extension.install-js': FileCode, // src/components/backstage/ExtensionManagerPanel.tsx:85
  'extension.install-zip': FileArchive, // src/components/backstage/ExtensionManagerPanel.tsx:82
  'extension.item': Puzzle, // src/components/backstage/ExtensionManagerPanel.tsx:177; ook Plus (src/components/backstage/ExtensionManagerPanel.tsx:353)
  'extension.runtime-browser': Globe, // src/components/dialogs/ExtensionConsentDialog.tsx:97
  'extension.runtime-desktop': HardDrive, // src/components/dialogs/ExtensionConsentDialog.tsx:97
  'extensions.manage': Puzzle, // src/components/backstage/Backstage.tsx:138
  'file.examples': BookOpen, // src/components/backstage/Backstage.tsx:122; ook Boxes (src/components/dialogs/JustUpdatedDialog.tsx:14)
  'file.export': Download, // src/components/backstage/LibrarySection.tsx:141
  'file.export-options': Download, // src/components/backstage/Backstage.tsx:128
  'file.import': Upload, // src/components/backstage/Backstage.tsx:129; ook Download (src/components/dialogs/JustUpdatedDialog.tsx:14)
  'file.local': HardDrive, // src/components/dialogs/SiteOpenDialog.tsx:227
  'file.new': FileText, // src/components/backstage/Backstage.tsx:118; ook FilePlus2 (src/components/dialogs/NewOrOpenProjectDialog.tsx:31)
  'file.open': FolderOpen, // src/components/backstage/Backstage.tsx:119
  'file.save': Save, // src/components/backstage/Backstage.tsx:123
  'file.save-as': SaveAll, // src/components/backstage/Backstage.tsx:124
  'file.type-other': FileType, // src/components/backstage/Backstage.tsx:292; ook FileText (src/components/dialogs/SiteOpenDialog.tsx:159)
  'file.type-project': FileText, // src/components/dialogs/RecoveryDialog.tsx:90
  'guide.compact': ChevronDown, // src/components/guide/GuidePanel.tsx:309
  'guide.expand': ChevronUp, // src/components/guide/GuidePanel.tsx:281
  'guide.tutorials': GraduationCap, // src/components/dialogs/TutorialOfferDialog.tsx:124
  'help.context-hint': Info, // src/components/common/Select.tsx:472
  'input.confirm-draft': Check, // src/components/backstage/LibrarySection.tsx:210
  'input.time-decrease': ChevronDown, // src/components/common/TimeInput.tsx:23
  'input.time-increase': ChevronUp, // src/components/common/TimeInput.tsx:20
  'layout.crew': HardHat, // src/components/viewControls/layoutIcons.tsx:18
  'layout.critical': Route, // src/components/viewControls/layoutIcons.tsx:21
  'layout.equipment': Truck, // src/components/viewControls/layoutIcons.tsx:19
  'layout.filter': Filter, // src/components/viewControls/layoutIcons.tsx:16
  'layout.flag': Flag, // src/components/viewControls/layoutIcons.tsx:23
  'layout.identity': LayoutTemplate, // src/components/viewControls/layoutIcons.tsx:13
  'layout.manage': Plus, // src/components/layout/Ribbon/ribbonWidgets.tsx:1015
  'layout.milestone': Milestone, // src/components/viewControls/layoutIcons.tsx:22
  'layout.period': CalendarRange, // src/components/viewControls/layoutIcons.tsx:24
  'layout.resources': Users, // src/components/viewControls/layoutIcons.tsx:17
  'layout.star': Star, // src/components/viewControls/layoutIcons.tsx:25
  'layout.task-tree': ListTree, // src/components/dialogs/JustUpdatedDialog.tsx:14
  'layout.tools': Wrench, // src/components/viewControls/layoutIcons.tsx:20
  'library.link-recognized': Link2, // src/components/dialogs/LibraryLinkDialog.tsx:82
  'link.open-external': ExternalLink, // src/components/dialogs/JustUpdatedDialog.tsx:104
  'list.filter': Filter, // src/components/layout/Ribbon/ribbonWidgets.tsx:1219
  'list.group-by': Layers, // src/components/layout/Ribbon/ribbonWidgets.tsx:860
  'list.item-remove': X, // src/components/dialogs/CalendarForm.tsx:716
  'list.sort-fields': ArrowUpDown, // src/components/layout/Ribbon/ribbonWidgets.tsx:907
  'log.pause-view': Pause, // src/components/panels/DebugTerminal.tsx:120
  'log.resume-view': Play, // src/components/panels/DebugTerminal.tsx:120
  'menu.item-checked': Check, // Vervangt het tekstteken ✓; ContextMenu.tsx:328 en ribbonWidgets.tsx:417 na #765.
  'menu.submenu': ChevronRight, // Vervangt de teksttekens ◂/▸; ContextMenu.tsx:352 na #765.
  'nav.back': ArrowLeft, // src/components/backstage/Backstage.tsx:114
  'object.rename': Pencil, // src/components/backstage/LibrarySection.tsx:218
  'panel.ai-activity': Activity, // src/components/ribbon/ai/AiActivityGroup.tsx:18
  'panel.debug-terminal': Terminal, // src/components/layout/StatusBar/StatusBar.tsx:179
  'panel.expand-full': Maximize2, // src/components/layout/RightRail/RightRail.tsx:262
  'panel.properties': Eye, // src/components/layout/Ribbon/ribbonConfig.tsx:728
  'panel.properties-hidden': EyeOff, // src/components/layout/Ribbon/ribbonConfig.tsx:754
  'panel.right': PanelRightClose, // src/components/layout/RightRail/RightRail.tsx:418; ook ChevronRight (src/components/layout/RightRail/RightRail.tsx:168)
  'panel.schedule-shift': ArrowLeftRight, // src/components/layout/Ribbon/ribbonConfig.tsx:420
  'panel.warnings': AlertTriangle, // src/components/layout/Ribbon/ribbonConfig.tsx:402
  'planning.bar-colors': Palette, // src/components/layout/Ribbon/ribbonWidgets.tsx:778
  'planning.baseline-overlay': LayoutGrid, // src/components/layout/Ribbon/BaselineOverlaySplitButton.tsx:71
  'planning.baselines': GitCompareArrows, // src/components/layout/Ribbon/ribbonWidgets.tsx:142
  'planning.clear-status-date': X, // src/components/layout/Ribbon/ribbonWidgets.tsx:118
  'planning.code-type-add': Plus, // src/components/dialogs/StructureDialog.tsx:123
  'planning.code-value-add': Plus, // src/components/dialogs/StructureDialog.tsx:101
  'planning.custom-field-add': Plus, // src/components/dialogs/StructureDialog.tsx:174
  'planning.dependency-add': Plus, // src/components/task-sections/TaskDependenciesSection.tsx:369
  'planning.dependency-draw-mode': Link, // src/components/layout/DependencyModeNotice.tsx:26
  'planning.driving': Zap, // src/components/task-grid/RelationCellEditor.tsx:170
  'planning.driving-unknown': CircleHelp, // src/components/task-grid/RelationCellEditor.tsx:181
  'planning.external-relation': Link2, // src/components/dialogs/ExternalLinkDialog.tsx:234
  'planning.float-band': MoveHorizontal, // src/components/layout/Ribbon/ribbonConfig.tsx:820
  'planning.gantt': GanttChartSquare, // src/components/viewControls/layoutIcons.tsx:14
  'planning.interruption-add': Plus, // src/components/task-sections/TaskSplitsSection.tsx:264
  'planning.interruption-remove': Trash2, // src/components/task-sections/TaskSplitsSection.tsx:163
  'planning.move-date': CalendarClock, // src/components/layout/Ribbon/ribbonConfig.tsx:352
  'planning.profile-new': Plus, // src/components/settings/SchedulingProfileSection.tsx:315
  'planning.progress-line': TrendingUp, // src/components/layout/Ribbon/ribbonConfig.tsx:782
  'planning.progress-menu': Flag, // src/components/layout/Ribbon/ribbonWidgets.tsx:160
  'planning.progress-sheet-export': FileDown, // src/components/layout/Ribbon/ribbonConfig.tsx:380
  'planning.progress-sheet-import': FileUp, // src/components/layout/Ribbon/ribbonConfig.tsx:364; ook ClipboardCheck (src/components/backstage/Backstage.tsx:649)
  'planning.relations-menu': Link, // src/components/layout/Ribbon/ribbonWidgets.tsx:406; ook GitBranch (src/components/dialogs/JustUpdatedDialog.tsx:14)
  'planning.relations-visible': Spline, // src/components/layout/Ribbon/ribbonConfig.tsx:835
  'planning.resource-accent': Palette, // src/components/layout/Ribbon/ribbonConfig.tsx:810
  'planning.status-date': CalendarClock, // src/components/layout/Ribbon/ribbonWidgets.tsx:97
  'planning.status-date-line': CalendarDays, // src/components/layout/Ribbon/ribbonConfig.tsx:790
  'planning.structure': Tags, // src/components/layout/Ribbon/ribbonConfig.tsx:447
  'planning.trace-predecessors': ArrowLeftToLine, // src/components/layout/Ribbon/ribbonConfig.tsx:201
  'planning.trace-successors': ArrowRightToLine, // src/components/layout/Ribbon/ribbonConfig.tsx:218
  'project.properties': Info, // src/components/backstage/Backstage.tsx:134
  'project.recent': History, // src/components/layout/Ribbon/ribbonWidgets.tsx:519; ook Clock (src/components/backstage/Backstage.tsx:120)
  'report.print-entry': Printer, // src/components/backstage/Backstage.tsx:130
  'report.workspace': BarChart3, // Geen oude tegenhanger of huidige aanroep; rapportweergave als staafdiagram.
  'resource.assign': UserPlus, // src/components/layout/Ribbon/ribbonWidgets.tsx:667
  'resource.availability-step-add': Plus, // src/components/panels/ResourcePanel.tsx:1322
  'resource.clear-level': Eraser, // src/components/layout/Ribbon/ribbonConfig.tsx:644
  'resource.dock': PanelRight, // src/components/layout/Ribbon/ribbonConfig.tsx:544
  'resource.level': Scale, // src/components/layout/Ribbon/ribbonConfig.tsx:640
  'resource.new': Plus, // src/components/layout/Ribbon/ribbonConfig.tsx:603
  'resource.next': ChevronRight, // src/components/layout/Ribbon/ribbonConfig.tsx:629
  'resource.previous': ChevronLeft, // src/components/layout/Ribbon/ribbonConfig.tsx:625
  'resource.unlink-library': Unlink2, // src/components/panels/ResourcePanel.tsx:1042
  'resource.workspace': Users, // src/components/layout/Ribbon/ribbonConfig.tsx:520
  'selection.mark': Check, // src/components/layout/Ribbon/BaselineOverlaySplitButton.tsx:127
  'solver.run': Play, // src/components/layout/Ribbon/ribbonConfig.tsx:123; ook RefreshCw (src/components/panels/WarningsPanel.tsx:183)
  'stats.downloads': BarChart3, // src/components/dialogs/StatsDialog.tsx:29
  'status.assignment-protected': Lock, // src/components/task-sections/TaskAssignmentsSection.tsx:187
  'status.bridge-live': Circle, // src/components/ribbon/ai/AiServerGroup.tsx:87
  'status.bridge-off': Circle, // src/components/ribbon/ai/AiServerGroup.tsx:87
  'status.busy': RefreshCw, // src/components/dialogs/UpdateDialog.tsx:172
  'status.column-present': Check, // src/components/task-grid/ColumnChooser.tsx:256
  'status.error': AlertTriangle, // src/components/dialogs/CalendarDialog.tsx:222; ook OctagonAlert (src/components/panels/WarningsPanel.tsx:204)
  'status.info': Info, // src/components/settings/SettingsPanelContent.tsx:409; ook AlertTriangle (src/components/panels/StatusBanner.tsx:43), FileDown (src/components/dialogs/ExternalLinkDialog.tsx:273), PackageOpen (src/components/dialogs/UpdateDialog.tsx:202)
  'status.install-size-larger': ArrowUp, // src/components/dialogs/JustUpdatedDialog.tsx:113
  'status.install-size-smaller': ArrowDown, // src/components/dialogs/JustUpdatedDialog.tsx:113
  'status.library-item-deviated': AlertCircle, // src/components/dialogs/LibraryLinkDialog.tsx:133
  'status.library-item-missing': AlertCircle, // src/components/dialogs/LibraryLinkDialog.tsx:133
  'status.library-linked': Library, // src/components/panels/ResourcePanel.tsx:836
  'status.library-suggestion': ArrowRight, // src/components/dialogs/LibraryLinkDialog.tsx:93
  'status.more-hidden': Ellipsis, // src/components/layout/StatusBar/StatusBar.tsx:160
  'status.project-calendar': Star, // src/components/dialogs/CalendarDialog.tsx:217
  'status.recorded-dates': CircleDot, // src/components/layout/RecordedDatesNotice.tsx:40
  'status.resource-overallocated': AlertTriangle, // src/components/layout/Ribbon/ribbonWidgets.tsx:1276
  'status.schedule-last-result': AlertTriangle, // src/components/panels/ResourceOccupancyView.tsx:511
  'status.schedule-preview': AlertTriangle, // src/components/panels/ResourceOccupancyView.tsx:511
  'status.structure-locked': ListTree, // src/components/layout/StructureLockedNotice.tsx:74
  'status.success': Check, // src/components/backstage/LibrarySection.tsx:161; ook CheckCircle2 (src/components/dialogs/UpdateDialog.tsx:179), CircleCheck (src/components/dialogs/FormatNoticeDialog.tsx:62)
  'status.update-available': Download, // src/components/dialogs/UpdateDialog.tsx:187
  'status.warning': AlertTriangle, // src/components/backstage/ExtensionManagerPanel.tsx:238; ook CircleMinus (src/components/dialogs/FormatNoticeDialog.tsx:66), ShieldAlert (src/components/dialogs/ExtensionConsentDialog.tsx:56)
  'table.column-add-menu': Plus, // src/components/task-grid/ColumnChooser.tsx:353
  'table.column-hide': Minus, // src/components/task-grid/DataGridHeader.tsx:521
  'table.columns': Columns3, // src/components/layout/Ribbon/ribbonConfig.tsx:317
  'table.columns-reset': RotateCcw, // src/components/task-grid/ColumnChooser.tsx:333
  'tabs.scroll-end': ChevronRight, // src/components/layout/DocumentChrome/DocumentTabBar.tsx:220
  'tabs.scroll-start': ChevronLeft, // src/components/layout/DocumentChrome/DocumentTabBar.tsx:208
  'task.add': Plus, // src/components/layout/Ribbon/ribbonConfig.tsx:132
  'task.indent': IndentIncrease, // src/components/layout/Ribbon/ribbonConfig.tsx:474
  'task.milestone-menu': Diamond, // src/components/layout/Ribbon/ribbonWidgets.tsx:276
  'task.note-add': Plus, // src/components/task-sections/TaskNotesFields.tsx:117
  'task.outdent': IndentDecrease, // src/components/layout/Ribbon/ribbonConfig.tsx:486
  'task.split-mode': Scissors, // src/components/layout/Ribbon/ribbonConfig.tsx:158
  'tree.collapse': ChevronDown, // src/components/dialogs/CalendarGeneratorFields.tsx:151
  'tree.collapse-scope': ChevronsDownUp, // src/components/layout/Ribbon/ribbonConfig.tsx:681
  'tree.expand': ChevronRight, // src/components/dialogs/CalendarGeneratorFields.tsx:151
  'tree.expand-scope': ChevronsUpDown, // src/components/layout/Ribbon/ribbonConfig.tsx:695
  'ui.check-updates': RotateCw, // src/components/dialogs/UpdateDialog.tsx:303
  'ui.close': X, // src/components/backstage/LibrarySection.tsx:211
  'ui.dropdown': ChevronDown, // src/components/common/Select.tsx:575
  'ui.help': BookOpen, // src/components/dialogs/FormatNoticeDialog.tsx:79; ook CircleHelp (src/components/common/HelpButton.tsx:46), LifeBuoy (src/components/backstage/Backstage.tsx:146)
  'ui.refresh': RefreshCw, // src/components/dialogs/ScreenshotAnnotator.tsx:461
  'ui.settings': Settings, // src/components/backstage/Backstage.tsx:135
  'ui.shortcuts': Keyboard, // src/components/dialogs/ShortcutsDialog.tsx:72
  'ui.tour': Compass, // src/components/backstage/Backstage.tsx:154
  'update.install': Download, // src/components/dialogs/UpdateDialog.tsx:324
  'view.fit': Maximize2, // src/components/layout/Ribbon/ribbonWidgets.tsx:1102
  'view.fullscreen': Maximize2, // src/components/layout/Ribbon/ribbonWidgets.tsx:1051
  'view.fullscreen-exit': Minimize2, // src/components/layout/Ribbon/ribbonWidgets.tsx:1051
  'view.gantt-split': SplitSquareHorizontal, // src/components/layout/Ribbon/ribbonWidgets.tsx:1058
  'view.minimap': Map, // src/components/layout/Ribbon/ribbonWidgets.tsx:1065
  'view.search': Search, // src/components/backstage/HelpPanel.tsx:397
  'view.zoom-default': Eye, // src/components/layout/Ribbon/ribbonWidgets.tsx:1097
  'view.zoom-in': ZoomIn, // src/components/layout/Ribbon/ribbonConfig.tsx:335
  'view.zoom-out': ZoomOut, // src/components/layout/Ribbon/ribbonConfig.tsx:339
  'wbs.auto-number': Hash, // src/components/layout/Ribbon/ribbonConfig.tsx:453
  'wbs.renumber': ListOrdered, // src/components/layout/Ribbon/ribbonConfig.tsx:461
  'wbs.templates': LayoutTemplate, // src/components/layout/Ribbon/ribbonWidgets.tsx:457
  'window.close': X, // src/components/layout/TitleBar/TitleBar.tsx:249
  'window.maximize': Square, // src/components/layout/TitleBar/TitleBar.tsx:246
  'window.minimize': Minus, // src/components/layout/TitleBar/TitleBar.tsx:243
  'window.restore': Copy, // src/components/layout/TitleBar/TitleBar.tsx:246
  'workspace.ribbon-collapse': ChevronUp, // src/components/layout/Ribbon/Ribbon.tsx:365
  'workspace.ribbon-expand': ChevronDown, // src/components/layout/Ribbon/Ribbon.tsx:365
} satisfies Record<IconId, LucideIcon>;

/**
 * Oude vormen voor plekken die vóór B2 een andere vorm hadden dan de tabel hierboven: één id had daar soms
 * meerdere oude vormen (zie de opmerkingen "ook …"). Een plek kiest er een met `<Icon lucide={{ icon: … }}>`.
 */
export const LUCIDE_SHAPES = {
  AlertTriangle, Boxes, CheckCircle2, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, CircleMinus,
  ClipboardCheck, Clock, Download, FileDown, FilePlus2, FileText, GitBranch, LayoutGrid, Library, LifeBuoy,
  ListTree, OctagonAlert, PackageOpen, Plus, RefreshCw, ShieldAlert,
} satisfies Record<string, LucideIcon>;
export type LucideShape = keyof typeof LUCIDE_SHAPES;
