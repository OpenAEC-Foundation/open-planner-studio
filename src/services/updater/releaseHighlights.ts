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
type LocalizedCopy = readonly [string, string, string, string, string, string, string, string, string, string];
// Elke rij bevat titel/uitleg voor hoofditem en de vier nevenitems. De inhoud
// hoort bewust bij de release, niet bij algemene interfacevertalingen.
const COPY: Record<Locale, LocalizedCopy> = {
  nl: ['Importeer met de datums uit je planning','Open MS Project-planningen met behoud van de vastgelegde datums.','Bezetting van resourcebibliotheken','Zie boekingen in alle geopende projecten.','Duidelijkere mijlpaalrelaties','Bekijk relaties met bruikbare terugkoppeling.','Consistente taaktypen','Nieuwe subtaken nemen het type van hun ouder over.','Rijkere voorbeeldprojecten','Voorbeelden bevatten nu realistische resourcesets.'],
  en: ['Import with the dates from your plan','Open MS Project schedules while retaining recorded planning dates.','Resource library occupancy','See bookings across open projects.','Clearer milestone relations','Inspect relations with useful feedback.','Consistent task types','New child tasks inherit their parent type.','Richer example projects','Examples now include realistic resource sets.'],
  fr: ['Importer avec les dates du planning','Ouvrez les plannings MS Project en conservant leurs dates.','Occupation des bibliothèques','Voyez les réservations des projets ouverts.','Relations de jalons plus claires','Examinez les relations avec un retour utile.','Types de tâches cohérents','Les sous-tâches héritent du type parent.','Exemples plus riches','Les exemples contiennent des ressources réalistes.'],
  de: ['Mit den Planterminen importieren','Öffnen Sie MS-Project-Pläne mit ihren gespeicherten Terminen.','Auslastung der Ressourcenbibliothek','Sehen Sie Buchungen offener Projekte.','Klarere Meilensteinbeziehungen','Prüfen Sie Beziehungen mit nützlichem Feedback.','Einheitliche Aufgabentypen','Neue Unteraufgaben übernehmen den Elterntyp.','Reichere Beispielprojekte','Beispiele enthalten realistische Ressourcen.'],
  es: ['Importar con fechas del plan','Abra planes de MS Project conservando sus fechas.','Ocupación de bibliotecas','Vea reservas de proyectos abiertos.','Relaciones de hitos claras','Revise relaciones con comentarios útiles.','Tipos de tarea coherentes','Las subtareas heredan el tipo padre.','Ejemplos más completos','Los ejemplos incluyen recursos realistas.'],
  it: ['Importa con le date del piano','Apri piani MS Project mantenendo le date registrate.','Occupazione delle librerie','Vedi le prenotazioni dei progetti aperti.','Relazioni milestone più chiare','Esamina relazioni con feedback utile.','Tipi di attività coerenti','Le sottoattività ereditano il tipo padre.','Esempi più ricchi','Gli esempi includono risorse realistiche.'],
  pt: ['Importar com datas do plano','Abra planos MS Project mantendo as datas registadas.','Ocupação das bibliotecas','Veja reservas dos projetos abertos.','Relações de marcos mais claras','Inspecione relações com feedback útil.','Tipos de tarefa consistentes','Subtarefas herdam o tipo pai.','Exemplos mais ricos','Exemplos incluem recursos realistas.'],
  pl: ['Importuj z datami planu','Otwieraj plany MS Project z zapisanymi datami.','Obłożenie bibliotek zasobów','Zobacz rezerwacje otwartych projektów.','Czytelniejsze relacje kamieni milowych','Sprawdź relacje z użyteczną informacją.','Spójne typy zadań','Podzadania dziedziczą typ rodzica.','Bogatsze przykłady','Przykłady zawierają realistyczne zasoby.'],
  tr: ['Plan tarihleriyle içe aktar','MS Project planlarını kayıtlı tarihleriyle açın.','Kaynak kitaplığı doluluğu','Açık projelerdeki rezervasyonları görün.','Daha açık kilometre taşı ilişkileri','İlişkileri yararlı geri bildirimle inceleyin.','Tutarlı görev türleri','Alt görevler üst türü devralır.','Daha zengin örnekler','Örnekler gerçekçi kaynaklar içerir.'],
  zh: ['按计划日期导入','打开并保留 MS Project 计划中的日期。','资源库占用','查看打开项目中的预订。','更清晰的里程碑关系','通过有用反馈检查关系。','一致的任务类型','子任务继承父任务类型。','更丰富的示例项目','示例现含真实资源集。'],
  ja: ['計画の日付でインポート','記録済みの日付を保って MS Project 計画を開きます。','リソースライブラリの稼働状況','開いているプロジェクトの予約を確認します。','より明確なマイルストーン関係','有用なフィードバックで関係を確認します。','一貫したタスク種類','子タスクは親の種類を継承します。','充実したサンプル','サンプルに現実的なリソースを追加しました。'],
  ko: ['계획 날짜로 가져오기','기록된 날짜를 유지하며 MS Project 계획을 엽니다.','리소스 라이브러리 점유','열린 프로젝트의 예약을 봅니다.','더 명확한 마일스톤 관계','유용한 피드백으로 관계를 확인합니다.','일관된 작업 유형','하위 작업이 상위 유형을 상속합니다.','더 풍부한 예제','예제에 현실적인 리소스가 있습니다.'],
  ar: ['استيراد بتواريخ الخطة','افتح خطط MS Project مع الاحتفاظ بالتواريخ المسجلة.','إشغال مكتبة الموارد','اعرض حجوزات المشاريع المفتوحة.','علاقات معالم أوضح','افحص العلاقات مع ملاحظات مفيدة.','أنواع مهام متسقة','ترث المهام الفرعية نوع الأصل.','أمثلة أغنى','تتضمن الأمثلة موارد واقعية.'],
  fa: ['وارد کردن با تاریخ‌های برنامه','برنامه‌های MS Project را با تاریخ‌های ثبت‌شده باز کنید.','اشغال کتابخانه منابع','رزروهای پروژه‌های باز را ببینید.','روابط نقطه‌عطف روشن‌تر','روابط را با بازخورد مفید بررسی کنید.','نوع وظیفه سازگار','زیرکارها نوع والد را می‌گیرند.','نمونه‌های غنی‌تر','نمونه‌ها منابع واقعی دارند.'],
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
  const [pt, pd, s1t, s1d, s2t, s2d, s3t, s3d, s4t, s4d] = copy;
  return { ...release, primary: { ...release.primary, title: pt, description: pd }, secondary: release.secondary.map((item, i) => ({ ...item, title: [s1t,s2t,s3t,s4t][i], description: [s1d,s2d,s3d,s4d][i] })) };
}

export function hasLocalizedReleaseContent(version: string): boolean { return !!RELEASES[version] && LOCALES.every(locale => COPY[locale].every(text => text.trim().length > 0)); }

export function isSafeHighlightIcon(icon: string): icon is HighlightIcon {
  return (HIGHLIGHT_ICONS as readonly string[]).includes(icon);
}
