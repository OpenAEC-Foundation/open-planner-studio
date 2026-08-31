/** Lokale, beperkte gegevens voor de visuele update-dialoog.
 *
 * Dit is nadrukkelijk geen tweede changelog: een release kiest hooguit vijf
 * onderwerpen. De releasepoort valideert dit bestand vóór een stabiele tag.
 */
export const HIGHLIGHT_ICONS = ['import', 'library', 'relations', 'tasks', 'examples'] as const;
export type HighlightIcon = (typeof HIGHLIGHT_ICONS)[number];

export interface ReleaseHighlight {
  icon: HighlightIcon;
  category: string;
  title: string;
  description: string;
  docsId?: string;
}

export interface ReleaseStats {
  daysSincePrevious?: number;
  commitsSincePrevious?: number;
  addedCodeLines?: number;
}

export interface ReleaseHighlights {
  version: string;
  primary: ReleaseHighlight;
  secondary: ReleaseHighlight[];
  stats: ReleaseStats;
}

const LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;
type Locale = (typeof LOCALES)[number];
interface LocalizedHighlight {
  category: string;
  title: string;
  description: string;
}
type LocalizedCopy = readonly [LocalizedHighlight, LocalizedHighlight, LocalizedHighlight, LocalizedHighlight, LocalizedHighlight];
// Elke rij bevat titel/uitleg voor hoofditem en de vier nevenitems. De inhoud
// hoort bewust bij de release, niet bij algemene interfacevertalingen.
const COPY: Record<Locale, LocalizedCopy> = {
  nl: [{ category: 'MS PROJECT', title: 'Importeer met de datums uit je planning', description: 'Open MS Project-planningen met behoud van de vastgelegde datums.' }, { category: 'RESOURCEBIBLIOTHEKEN', title: 'Bezetting van resourcebibliotheken', description: 'Zie boekingen in alle geopende projecten.' }, { category: 'RELATIES', title: 'Duidelijkere mijlpaalrelaties', description: 'Bekijk relaties met bruikbare terugkoppeling.' }, { category: 'TAKEN', title: 'Consistente taaktypen', description: 'Nieuwe subtaken nemen het type van hun ouder over.' }, { category: 'VOORBEELDEN', title: 'Rijkere voorbeeldprojecten', description: 'Voorbeelden bevatten nu realistische resourcesets.' }],
  en: [{ category: 'MS PROJECT', title: 'Import with the dates from your plan', description: 'Open MS Project schedules while retaining recorded planning dates.' }, { category: 'RESOURCES', title: 'Resource library occupancy', description: 'See bookings across open projects.' }, { category: 'RELATIONS', title: 'Clearer milestone relations', description: 'Inspect relations with useful feedback.' }, { category: 'TASKS', title: 'Consistent task types', description: 'New child tasks inherit their parent type.' }, { category: 'EXAMPLES', title: 'Richer example projects', description: 'Examples now include realistic resource sets.' }],
  fr: [{ category: 'MS PROJECT', title: 'Importer avec les dates du planning', description: 'Ouvrez les plannings MS Project en conservant leurs dates.' }, { category: 'RESSOURCES', title: 'Occupation des bibliothèques', description: 'Voyez les réservations des projets ouverts.' }, { category: 'RELATIONS', title: 'Relations de jalons plus claires', description: 'Examinez les relations avec un retour utile.' }, { category: 'TÂCHES', title: 'Types de tâches cohérents', description: 'Les sous-tâches héritent du type parent.' }, { category: 'EXEMPLES', title: 'Exemples plus riches', description: 'Les exemples contiennent des ressources réalistes.' }],
  de: [{ category: 'MS PROJECT', title: 'Mit den Planterminen importieren', description: 'Öffnen Sie MS-Project-Pläne mit ihren gespeicherten Terminen.' }, { category: 'RESSOURCEN', title: 'Auslastung der Ressourcenbibliothek', description: 'Sehen Sie Buchungen offener Projekte.' }, { category: 'BEZIEHUNGEN', title: 'Klarere Meilensteinbeziehungen', description: 'Prüfen Sie Beziehungen mit nützlichem Feedback.' }, { category: 'AUFGABEN', title: 'Einheitliche Aufgabentypen', description: 'Neue Unteraufgaben übernehmen den Elterntyp.' }, { category: 'BEISPIELE', title: 'Reichere Beispielprojekte', description: 'Beispiele enthalten realistische Ressourcen.' }],
  es: [{ category: 'MS PROJECT', title: 'Importar con fechas del plan', description: 'Abra planes de MS Project conservando sus fechas.' }, { category: 'RECURSOS', title: 'Ocupación de bibliotecas', description: 'Vea reservas de proyectos abiertos.' }, { category: 'RELACIONES', title: 'Relaciones de hitos claras', description: 'Revise relaciones con comentarios útiles.' }, { category: 'TAREAS', title: 'Tipos de tarea coherentes', description: 'Las subtareas heredan el tipo padre.' }, { category: 'EJEMPLOS', title: 'Ejemplos más completos', description: 'Los ejemplos incluyen recursos realistas.' }],
  it: [{ category: 'MS PROJECT', title: 'Importa con le date del piano', description: 'Apri piani MS Project mantenendo le date registrate.' }, { category: 'RISORSE', title: 'Occupazione delle librerie', description: 'Vedi le prenotazioni dei progetti aperti.' }, { category: 'RELAZIONI', title: 'Relazioni milestone più chiare', description: 'Esamina relazioni con feedback utile.' }, { category: 'ATTIVITÀ', title: 'Tipi di attività coerenti', description: 'Le sottoattività ereditano il tipo padre.' }, { category: 'ESEMPI', title: 'Esempi più ricchi', description: 'Gli esempi includono risorse realistiche.' }],
  pt: [{ category: 'MS PROJECT', title: 'Importar com datas do plano', description: 'Abra planos MS Project mantendo as datas registadas.' }, { category: 'RECURSOS', title: 'Ocupação das bibliotecas', description: 'Veja reservas dos projetos abertos.' }, { category: 'RELAÇÕES', title: 'Relações de marcos mais claras', description: 'Inspecione relações com feedback útil.' }, { category: 'TAREFAS', title: 'Tipos de tarefa consistentes', description: 'Subtarefas herdam o tipo pai.' }, { category: 'EXEMPLOS', title: 'Exemplos mais ricos', description: 'Exemplos incluem recursos realistas.' }],
  pl: [{ category: 'MS PROJECT', title: 'Importuj z datami planu', description: 'Otwieraj plany MS Project z zapisanymi datami.' }, { category: 'ZASOBY', title: 'Obłożenie bibliotek zasobów', description: 'Zobacz rezerwacje otwartych projektów.' }, { category: 'RELACJE', title: 'Czytelniejsze relacje kamieni milowych', description: 'Sprawdź relacje z użyteczną informacją.' }, { category: 'ZADANIA', title: 'Spójne typy zadań', description: 'Podzadania dziedziczą typ rodzica.' }, { category: 'PRZYKŁADY', title: 'Bogatsze przykłady', description: 'Przykłady zawierają realistyczne zasoby.' }],
  tr: [{ category: 'MS PROJECT', title: 'Plan tarihleriyle içe aktar', description: 'MS Project planlarını kayıtlı tarihleriyle açın.' }, { category: 'KAYNAKLAR', title: 'Kaynak kitaplığı doluluğu', description: 'Açık projelerdeki rezervasyonları görün.' }, { category: 'İLİŞKİLER', title: 'Daha açık kilometre taşı ilişkileri', description: 'İlişkileri yararlı geri bildirimle inceleyin.' }, { category: 'GÖREVLER', title: 'Tutarlı görev türleri', description: 'Alt görevler üst türü devralır.' }, { category: 'ÖRNEKLER', title: 'Daha zengin örnekler', description: 'Örnekler gerçekçi kaynaklar içerir.' }],
  zh: [{ category: 'MS PROJECT', title: '按计划日期导入', description: '打开并保留 MS Project 计划中的日期。' }, { category: '资源', title: '资源库占用', description: '查看打开项目中的预订。' }, { category: '关系', title: '更清晰的里程碑关系', description: '通过有用反馈检查关系。' }, { category: '任务', title: '一致的任务类型', description: '子任务继承父任务类型。' }, { category: '示例', title: '更丰富的示例项目', description: '示例现含真实资源集。' }],
  ja: [{ category: 'MS PROJECT', title: '計画の日付でインポート', description: '記録済みの日付を保って MS Project 計画を開きます。' }, { category: 'リソース', title: 'リソースライブラリの稼働状況', description: '開いているプロジェクトの予約を確認します。' }, { category: '関係', title: 'より明確なマイルストーン関係', description: '有用なフィードバックで関係を確認します。' }, { category: 'タスク', title: '一貫したタスク種類', description: '子タスクは親の種類を継承します。' }, { category: 'サンプル', title: '充実したサンプル', description: 'サンプルに現実的なリソースを追加しました。' }],
  ko: [{ category: 'MS PROJECT', title: '계획 날짜로 가져오기', description: '기록된 날짜를 유지하며 MS Project 계획을 엽니다.' }, { category: '리소스', title: '리소스 라이브러리 점유', description: '열린 프로젝트의 예약을 봅니다.' }, { category: '관계', title: '더 명확한 마일스톤 관계', description: '유용한 피드백으로 관계를 확인합니다.' }, { category: '작업', title: '일관된 작업 유형', description: '하위 작업이 상위 유형을 상속합니다.' }, { category: '예제', title: '더 풍부한 예제', description: '예제에 현실적인 리소스가 있습니다.' }],
  ar: [{ category: 'MS PROJECT', title: 'استيراد بتواريخ الخطة', description: 'افتح خطط MS Project مع الاحتفاظ بالتواريخ المسجلة.' }, { category: 'الموارد', title: 'إشغال مكتبة الموارد', description: 'اعرض حجوزات المشاريع المفتوحة.' }, { category: 'العلاقات', title: 'علاقات معالم أوضح', description: 'افحص العلاقات مع ملاحظات مفيدة.' }, { category: 'المهام', title: 'أنواع مهام متسقة', description: 'ترث المهام الفرعية نوع الأصل.' }, { category: 'الأمثلة', title: 'أمثلة أغنى', description: 'تتضمن الأمثلة موارد واقعية.' }],
  fa: [{ category: 'MS PROJECT', title: 'وارد کردن با تاریخ‌های برنامه', description: 'برنامه‌های MS Project را با تاریخ‌های ثبت‌شده باز کنید.' }, { category: 'منابع', title: 'اشغال کتابخانه منابع', description: 'رزروهای پروژه‌های باز را ببینید.' }, { category: 'روابط', title: 'روابط نقطه‌عطف روشن‌تر', description: 'روابط را با بازخورد مفید بررسی کنید.' }, { category: 'وظایف', title: 'نوع وظیفه سازگار', description: 'زیرکارها نوع والد را می‌گیرند.' }, { category: 'نمونه‌ها', title: 'نمونه‌های غنی‌تر', description: 'نمونه‌ها منابع واقعی دارند.' }],
};

// Cijfers zijn bij v2026.8.1 uit v2026.8.0..v2026.8.1 bepaald: git rev-list
// --count en git diff --numstat met docs, i18n, lock- en gegenereerde bestanden uitgesloten.
const RELEASES: Record<string, ReleaseHighlights> = {
  '2026.8.1': {
    version: '2026.8.1',
    primary: {
      icon: 'import',
      category: 'MS PROJECT',
      title: 'Import with the dates from your plan',
      description: 'Open MS Project schedules while retaining the recorded planning dates where that matters.',
      docsId: 'gids-msproject-import',
    },
    secondary: [
      { icon: 'library', category: 'RESOURCES', title: 'Resource library occupancy', description: 'See bookings across the open projects that share a resource library.', docsId: 'gids-bezettingsoverzicht' },
      { icon: 'relations', category: 'RELATIONS', title: 'Clearer milestone relations', description: 'Inspect relationships on milestones and summary tasks with more useful feedback.', docsId: 'gids-relaties-constraints' },
      { icon: 'tasks', category: 'TASKS', title: 'Consistent task types', description: 'New child tasks inherit their parent task type.', docsId: 'gids-plannen-wbs' },
      { icon: 'examples', category: 'EXAMPLES', title: 'Richer example projects', description: 'Bundled examples now include realistic resource sets.', docsId: 'gids-resources-histogram' },
    ],
    stats: { daysSincePrevious: 2, commitsSincePrevious: 360, addedCodeLines: 45066 },
  },
};

export function getReleaseHighlights(version: string, locale = 'en'): ReleaseHighlights | null {
  const release = RELEASES[version.replace(/^v/i, '')];
  const copy = COPY[locale.split('-')[0] as Locale];
  if (!release || !copy) return release ?? null;
  const [primary, ...secondary] = copy;
  return { ...release, primary: { ...release.primary, ...primary }, secondary: release.secondary.map((item, i) => ({ ...item, ...secondary[i] })) };
}

export function hasLocalizedReleaseContent(version: string): boolean {
  return !!RELEASES[version] && LOCALES.every(locale => COPY[locale].every(item => Object.values(item).every(text => text.trim().length > 0)));
}

export function isSafeHighlightIcon(icon: string): icon is HighlightIcon {
  return (HIGHLIGHT_ICONS as readonly string[]).includes(icon);
}
