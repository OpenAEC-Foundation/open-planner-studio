/** Lokale, versiegebonden gegevens voor de visuele update-dialoog.
 *
 * Dit is nadrukkelijk geen tweede changelog. Elke release krijgt één nieuw blok
 * met precies vijf onderwerpen en alle locale copy; een volgende release raakt
 * het blok van een uitgebrachte versie dus niet.
 */
export const HIGHLIGHT_ICONS = ['import', 'library', 'relations', 'tasks', 'examples'] as const;
export type HighlightIcon = (typeof HIGHLIGHT_ICONS)[number];

export const RELEASE_HIGHLIGHT_LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;
export type ReleaseHighlightLocale = (typeof RELEASE_HIGHLIGHT_LOCALES)[number];

export interface LocalizedReleaseHighlight {
  readonly category: string;
  readonly title: string;
  readonly description: string;
}

/** Eén primary en exact vier secondary-kaarten: de vaste U4-layout. */
export type LocalizedReleaseCopy = readonly [
  LocalizedReleaseHighlight,
  LocalizedReleaseHighlight,
  LocalizedReleaseHighlight,
  LocalizedReleaseHighlight,
  LocalizedReleaseHighlight,
];

/** Alleen de prominente kaart mag naar een in-app gids verwijzen. */
export interface PrimaryHighlightDefinition {
  readonly icon: HighlightIcon;
  readonly docsId?: string;
}

/** Compacte kaarten kennen bewust geen docsId en dus geen gidsknop. */
export interface SecondaryHighlightDefinition {
  readonly icon: HighlightIcon;
}

export type FourSecondaryHighlightDefinitions = readonly [
  SecondaryHighlightDefinition,
  SecondaryHighlightDefinition,
  SecondaryHighlightDefinition,
  SecondaryHighlightDefinition,
];

export interface ReleaseStats {
  readonly daysSincePrevious: number;
  readonly commitsSincePrevious: number;
  readonly addedCodeLines: number;
}

/** De enige gegevens die een volgende release toevoegt: één volledig versieblok. */
export interface VersionedReleaseHighlights {
  readonly primary: PrimaryHighlightDefinition;
  readonly secondary: FourSecondaryHighlightDefinitions;
  readonly stats: ReleaseStats;
  readonly copy: Readonly<Record<ReleaseHighlightLocale, LocalizedReleaseCopy>>;
}

export type ReleaseHighlightCatalog = Readonly<Record<string, VersionedReleaseHighlights>>;

/** Contextueel getypeerde ingang: ontbrekende locales, een vijfde kaart of een secondary docsId falen bij typecheck. */
export function defineReleaseHighlightCatalog(catalog: Record<string, VersionedReleaseHighlights>): ReleaseHighlightCatalog {
  return catalog;
}

/**
 * Leesvorm voor de bestaande, onveranderde U4-component. De catalogus en de
 * specifiekere varianten hieronder begrenzen waar een docsId terecht mag komen.
 */
export interface ReleaseHighlight extends LocalizedReleaseHighlight {
  readonly icon: HighlightIcon;
  readonly docsId?: string;
}

export interface PrimaryReleaseHighlight extends ReleaseHighlight, PrimaryHighlightDefinition {}
export interface SecondaryReleaseHighlight extends ReleaseHighlight, SecondaryHighlightDefinition {
  readonly docsId?: never;
}
export type FourSecondaryReleaseHighlights = readonly [
  SecondaryReleaseHighlight,
  SecondaryReleaseHighlight,
  SecondaryReleaseHighlight,
  SecondaryReleaseHighlight,
];

export interface ReleaseHighlights {
  readonly version: string;
  readonly primary: PrimaryReleaseHighlight;
  readonly secondary: FourSecondaryReleaseHighlights;
  readonly stats: ReleaseStats;
}

// Cijfers zijn bij v2026.8.1 uit v2026.8.0..v2026.8.1 bepaald: git rev-list
// --count en git diff --numstat met docs, i18n, lock- en gegenereerde bestanden uitgesloten.
export const RELEASE_HIGHLIGHT_CATALOG = defineReleaseHighlightCatalog({
  '2026.8.1': {
    primary: { icon: 'import', docsId: 'gids-msproject-import' },
    secondary: [{ icon: 'library' }, { icon: 'relations' }, { icon: 'tasks' }, { icon: 'examples' }],
    stats: { daysSincePrevious: 2, commitsSincePrevious: 360, addedCodeLines: 45066 },
    copy: {
      nl: [{ category: 'MS PROJECT', title: 'Importeer met de datums uit je planning', description: 'Open MS Project-planningen met behoud van de vastgelegde datums.' }, { category: 'RESOURCEBIBLIOTHEKEN', title: 'Bezetting van resourcebibliotheken', description: 'Zie boekingen in alle geopende projecten.' }, { category: 'RELATIES', title: 'Duidelijkere mijlpaalrelaties', description: 'Bekijk relaties met bruikbare terugkoppeling.' }, { category: 'TAKEN', title: 'Consistente taaktypen', description: 'Nieuwe subtaken nemen het type van hun ouder over.' }, { category: 'VOORBEELDEN', title: 'Rijkere voorbeeldprojecten', description: 'Voorbeelden bevatten nu realistische resourcesets.' }],
      en: [{ category: 'MS PROJECT', title: 'Import with the dates from your plan', description: 'Open MS Project schedules while retaining recorded planning dates.' }, { category: 'RESOURCES', title: 'Resource library occupancy', description: 'See bookings across open projects.' }, { category: 'RELATIONS', title: 'Clearer milestone relations', description: 'Inspect relations with useful feedback.' }, { category: 'TASKS', title: 'Consistent task types', description: 'New child tasks inherit their parent type.' }, { category: 'EXAMPLES', title: 'Richer example projects', description: 'Examples now include realistic resource sets.' }],
      fr: [{ category: 'MS PROJECT', title: 'Importer avec les dates du planning', description: 'Ouvrez les plannings MS Project en conservant leurs dates.' }, { category: 'RESSOURCES', title: 'Occupation des bibliothèques', description: 'Voyez les réservations des projets ouverts.' }, { category: 'RELATIONS', title: 'Relations de jalons plus claires', description: 'Examinez les relations avec un retour utile.' }, { category: 'TÂCHES', title: 'Types de tâches cohérents', description: 'Les sous-tâches héritent du type parent.' }, { category: 'EXEMPLES', title: 'Exemples plus riches', description: 'Les exemples contiennent des ressources réalistes.' }],
      de: [{ category: 'MS PROJECT', title: 'Mit den Planterminen importieren', description: 'Öffnen Sie MS-Project-Pläne mit ihren gespeicherten Terminen.' }, { category: 'RESSOURCEN', title: 'Auslastung der Ressourcenbibliothek', description: 'Sehen Sie Buchungen offener Projekte.' }, { category: 'BEZIEHUNGEN', title: 'Klarere Meilensteinbeziehungen', description: 'Prüfen Sie Beziehungen mit nützlichem Feedback.' }, { category: 'AUFGABEN', title: 'Einheitliche Aufgabentypen', description: 'Neue Unteraufgaben übernehmen den Elterntyp.' }, { category: 'BEISPIELE', title: 'Reichere Beispielprojekte', description: 'Beispiele enthalten realistische Ressourcen.' }],
      es: [{ category: 'MS PROJECT', title: 'Importar con fechas del plan', description: 'Abra planes de MS Project conservando sus fechas.' }, { category: 'RECURSOS', title: 'Ocupación de bibliotecas', description: 'Vea reservas de proyectos abiertos.' }, { category: 'RELACIONES', title: 'Relaciones de hitos claras', description: 'Revise relaciones con comentarios útiles.' }, { category: 'TAREAS', title: 'Tipos de tarea coherentes', description: 'Las subtareas heredan el tipo padre.' }, { category: 'EJEMPLOS', title: 'Ejemplos más completos', description: 'Los ejemplos incluyen recursos realistas.' }],
      it: [{ category: 'MS PROJECT', title: 'Importa con le date del piano', description: 'Apri piani MS Project mantenendo le date registrate.' }, { category: 'RISORSE', title: 'Occupazione delle librerie', description: 'Vedi le prenotazioni dei progetti aperti.' }, { category: 'RELAZIONI', title: 'Relazioni milestone più chiare', description: 'Esamina relazioni con feedback utile.' }, { category: 'ATTIVITÀ', title: 'Tipi di attività coerenti', description: 'Le sottoattività ereditano il tipo parent.' }, { category: 'ESEMPI', title: 'Esempi più ricchi', description: 'Gli esempi includono risorse realistiche.' }],
      pt: [{ category: 'MS PROJECT', title: 'Importar com datas do plano', description: 'Abra planos MS Project mantendo as datas registadas.' }, { category: 'RECURSOS', title: 'Ocupação das bibliotecas', description: 'Veja reservas dos projetos abertos.' }, { category: 'RELAÇÕES', title: 'Relações de marcos mais claras', description: 'Inspecione relações com feedback útil.' }, { category: 'TAREFAS', title: 'Tipos de tarefa consistentes', description: 'Subtarefas herdam o tipo pai.' }, { category: 'EXEMPLOS', title: 'Exemplos mais ricos', description: 'Exemplos incluem recursos realistas.' }],
      pl: [{ category: 'MS PROJECT', title: 'Importuj z datami planu', description: 'Otwieraj plany MS Project z zapisanymi datami.' }, { category: 'ZASOBY', title: 'Obłożenie bibliotek zasobów', description: 'Zobacz rezerwacje otwartych projektów.' }, { category: 'RELACJE', title: 'Czytelniejsze relacje kamieni milowych', description: 'Sprawdź relacje z użyteczną informacją.' }, { category: 'ZADANIA', title: 'Spójne typy zadań', description: 'Podzadania dziedziczą typ rodzica.' }, { category: 'PRZYKŁADY', title: 'Bogatsze przykłady', description: 'Przykłady zawierają realistyczne zasoby.' }],
      tr: [{ category: 'MS PROJECT', title: 'Plan tarihleriyle içe aktar', description: 'MS Project planlarını kayıtlı tarihleriyle açın.' }, { category: 'KAYNAKLAR', title: 'Kaynak kitaplığı doluluğu', description: 'Açık projelerdeki rezervasyonları görün.' }, { category: 'İLİŞKİLER', title: 'Daha açık kilometre taşı ilişkileri', description: 'İlişkileri yararlı geri bildirimle inceleyin.' }, { category: 'GÖREVLER', title: 'Tutarlı görev türleri', description: 'Alt görevler üst türü devralır.' }, { category: 'ÖRNEKLER', title: 'Daha zengin örnekler', description: 'Örnekler gerçekçi kaynaklar içerir.' }],
      zh: [{ category: 'MS PROJECT', title: '按计划日期导入', description: '打开并保留 MS Project 计划中的日期。' }, { category: '资源', title: '资源库占用', description: '查看打开项目中的预订。' }, { category: '关系', title: '更清晰的里程碑关系', description: '通过有用反馈检查关系。' }, { category: '任务', title: '一致的任务类型', description: '子任务继承父任务类型。' }, { category: '示例', title: '更丰富的示例项目', description: '示例现含真实资源集。' }],
      ja: [{ category: 'MS PROJECT', title: '計画の日付でインポート', description: '記録済みの日付を保って MS Project 計画を開きます。' }, { category: 'リソース', title: 'リソースライブラリの稼働状況', description: '開いているプロジェクトの予約を確認します。' }, { category: '関係', title: 'より明確なマイルストーン関係', description: '有用なフィードバックで関係を確認します。' }, { category: 'タスク', title: '一貫したタスク種類', description: '子タスクは親の種類を継承します。' }, { category: 'サンプル', title: '充実したサンプル', description: 'サンプルに現実的なリソースを追加しました。' }],
      ko: [{ category: 'MS PROJECT', title: '계획 날짜로 가져오기', description: '기록된 날짜를 유지하며 MS Project 계획을 엽니다.' }, { category: '리소스', title: '리소스 라이브러리 점유', description: '열린 프로젝트의 예약을 봅니다.' }, { category: '관계', title: '더 명확한 마일스톤 관계', description: '유용한 피드백으로 관계를 확인합니다.' }, { category: '작업', title: '일관된 작업 유형', description: '하위 작업이 상위 유형을 상속합니다.' }, { category: '예제', title: '더 풍부한 예제', description: '예제에 현실적인 리소스가 있습니다.' }],
      ar: [{ category: 'MS PROJECT', title: 'استيراد بتواريخ الخطة', description: 'افتح خطط MS Project مع الاحتفاظ بالتواريخ المسجلة.' }, { category: 'الموارد', title: 'إشغال مكتبة الموارد', description: 'اعرض حجوزات المشاريع المفتوحة.' }, { category: 'العلاقات', title: 'علاقات معالم أوضح', description: 'افحص العلاقات مع ملاحظات مفيدة.' }, { category: 'المهام', title: 'أنواع مهام متسقة', description: 'ترث المهام الفرعية نوع الأصل.' }, { category: 'الأمثلة', title: 'أمثلة أغنى', description: 'تتضمن الأمثلة موارد واقعية.' }],
      fa: [{ category: 'MS PROJECT', title: 'وارد کردن با تاریخ‌های برنامه', description: 'برنامه‌های MS Project را با تاریخ‌های ثبت‌شده باز کنید.' }, { category: 'منابع', title: 'اشغال کتابخانه منابع', description: 'رزروهای پروژه‌های باز را ببینید.' }, { category: 'روابط', title: 'روابط نقطه‌عطف روشن‌تر', description: 'روابط را با بازخورد مفید بررسی کنید.' }, { category: 'وظایف', title: 'نوع وظیفه سازگار', description: 'زیرکارها نوع والد را می‌گیرند.' }, { category: 'نمونه‌ها', title: 'نمونه‌های غنی‌تر', description: 'نمونه‌ها منابع واقعی دارند.' }],
    },
  },
});

export function getReleaseHighlightsFromCatalog(catalog: ReleaseHighlightCatalog, version: string, locale = 'en'): ReleaseHighlights | null {
  const normalizedVersion = version.replace(/^v/i, '');
  const release = catalog[normalizedVersion];
  if (!release) return null;
  const copy = release.copy[locale.split('-')[0] as ReleaseHighlightLocale] ?? release.copy.en;
  const [primaryCopy, secondaryOne, secondaryTwo, secondaryThree, secondaryFour] = copy;
  return {
    version: normalizedVersion,
    primary: { ...release.primary, ...primaryCopy },
    secondary: [
      { ...release.secondary[0], ...secondaryOne },
      { ...release.secondary[1], ...secondaryTwo },
      { ...release.secondary[2], ...secondaryThree },
      { ...release.secondary[3], ...secondaryFour },
    ],
    stats: release.stats,
  };
}

export function getReleaseHighlights(version: string, locale = 'en'): ReleaseHighlights | null {
  return getReleaseHighlightsFromCatalog(RELEASE_HIGHLIGHT_CATALOG, version, locale);
}

export function isSafeHighlightIcon(icon: string): icon is HighlightIcon {
  return (HIGHLIGHT_ICONS as readonly string[]).includes(icon);
}

/** Alleen volledige CalVer-tags tellen mee als voorganger van een stabiele release. */
export function isStableReleaseTag(tag: string): boolean {
  return /^v\d+\.\d+\.\d+$/.test(tag);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unexpectedFields(value: unknown, allowed: readonly string[]): string[] {
  return isRecord(value) ? Object.keys(value).filter(key => !allowed.includes(key)) : ['(geen object)'];
}

/** Runtime-tegenhanger van het TypeScript-contract voor de taggebonden releasepoort. */
export function validateReleaseHighlightCatalog(catalog: ReleaseHighlightCatalog, version: string): string[] {
  const normalizedVersion = version.replace(/^v/i, '');
  const release = catalog[normalizedVersion] as unknown;
  const errors: string[] = [];
  if (!isRecord(release)) return [`${normalizedVersion}: versieblok ontbreekt`];

  const topLevelUnexpected = unexpectedFields(release, ['primary', 'secondary', 'stats', 'copy']);
  if (topLevelUnexpected.length) errors.push(`${normalizedVersion}: verboden releasevelden: ${topLevelUnexpected.join(', ')}`);
  const primary = release.primary;
  const secondary = release.secondary;
  const stats = release.stats;
  const copy = release.copy;

  const primaryUnexpected = unexpectedFields(primary, ['icon', 'docsId']);
  if (primaryUnexpected.length) errors.push(`${normalizedVersion}: verboden primary-velden: ${primaryUnexpected.join(', ')}`);
  if (!isRecord(primary) || typeof primary.icon !== 'string' || !isSafeHighlightIcon(primary.icon)) errors.push(`${normalizedVersion}: primary heeft geen veilig pictogram`);
  if (isRecord(primary) && primary.docsId !== undefined && (typeof primary.docsId !== 'string' || primary.docsId.trim() === '')) errors.push(`${normalizedVersion}: primary docsId is leeg of ongeldig`);

  if (!Array.isArray(secondary) || secondary.length !== 4) {
    errors.push(`${normalizedVersion}: verwacht exact 4 secondary highlights`);
  } else {
    secondary.forEach((item, index) => {
      const unexpected = unexpectedFields(item, ['icon']);
      if (unexpected.length) errors.push(`${normalizedVersion}: secondary ${index + 1} heeft verboden velden: ${unexpected.join(', ')}`);
      if (!isRecord(item) || typeof item.icon !== 'string' || !isSafeHighlightIcon(item.icon)) errors.push(`${normalizedVersion}: secondary ${index + 1} heeft geen veilig pictogram`);
    });
  }

  const statsUnexpected = unexpectedFields(stats, ['daysSincePrevious', 'commitsSincePrevious', 'addedCodeLines']);
  if (statsUnexpected.length) errors.push(`${normalizedVersion}: verboden statistiekvelden: ${statsUnexpected.join(', ')}`);
  for (const key of ['daysSincePrevious', 'commitsSincePrevious', 'addedCodeLines']) {
    if (!isRecord(stats) || typeof stats[key] !== 'number' || !Number.isInteger(stats[key]) || stats[key] < 0) errors.push(`${normalizedVersion}: statistiek ${key} ontbreekt of is ongeldig`);
  }

  if (!isRecord(copy)) {
    errors.push(`${normalizedVersion}: locale copy ontbreekt`);
  } else {
    const locales = Object.keys(copy);
    const missing = RELEASE_HIGHLIGHT_LOCALES.filter(locale => !(locale in copy));
    const extra = locales.filter(locale => !(RELEASE_HIGHLIGHT_LOCALES as readonly string[]).includes(locale));
    if (missing.length) errors.push(`${normalizedVersion}: ontbrekende locales: ${missing.join(', ')}`);
    if (extra.length) errors.push(`${normalizedVersion}: onbekende locales: ${extra.join(', ')}`);
    for (const locale of RELEASE_HIGHLIGHT_LOCALES) {
      const localizedCopy = copy[locale];
      if (!Array.isArray(localizedCopy) || localizedCopy.length !== 5) {
        errors.push(`${normalizedVersion}: ${locale} verwacht primary plus exact 4 secondary teksten`);
        continue;
      }
      localizedCopy.forEach((item, index) => {
        const unexpected = unexpectedFields(item, ['category', 'title', 'description']);
        if (unexpected.length) errors.push(`${normalizedVersion}: ${locale} kaart ${index + 1} heeft verboden copyvelden: ${unexpected.join(', ')}`);
        for (const key of ['category', 'title', 'description']) {
          if (!isRecord(item) || typeof item[key] !== 'string' || item[key].trim() === '') errors.push(`${normalizedVersion}: ${locale} kaart ${index + 1} mist ${key}`);
        }
      });
    }
  }
  return errors;
}

/** Vergelijk de bewaarde releasecijfers met de reproduceerbare Git-meting van de releasepoort. */
export function validateReleaseHighlightStats(catalog: ReleaseHighlightCatalog, version: string, measured: ReleaseStats): string[] {
  const normalizedVersion = version.replace(/^v/i, '');
  const configured = catalog[normalizedVersion];
  if (!configured) return [`${normalizedVersion}: versieblok ontbreekt`];
  return (['daysSincePrevious', 'commitsSincePrevious', 'addedCodeLines'] as const)
    .filter(key => configured.stats[key] !== measured[key])
    .map(key => `${normalizedVersion}: ${key}=${configured.stats[key]} komt niet overeen met Git-meting ${measured[key]}`);
}

export function hasLocalizedReleaseContent(version: string): boolean {
  return validateReleaseHighlightCatalog(RELEASE_HIGHLIGHT_CATALOG, version).length === 0;
}
