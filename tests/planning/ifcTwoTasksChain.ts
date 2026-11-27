const fixtureGuid = (label: string) => label.padEnd(22, '0').slice(0, 22);
export function twoTasksAndChain(content: string): string {
  const end = content.lastIndexOf('ENDSEC;');
  return content.slice(0, end) + [
    `#9001=IFCRELASSIGNSTOPRODUCT('${fixtureGuid('1RegelTweeLijst')}',$,$,$,(#51),$,#393);`,
    `#9002=IFCRELASSIGNSTOPROCESS('${fixtureGuid('1RegelTweeEnkel')}',$,$,$,(#354),$,#51,$);`,
    `#9003=IFCRELASSIGNSTOPRODUCT('${fixtureGuid('1RegelEenTweeLeden')}',$,$,$,(#51,#53),$,#354);`,
    '#9004=IFCPROPERTYREFERENCEVALUE(\'Taak\',$,$,#51);',
    `#9005=IFCPROPERTYSET('${fixtureGuid('1RegelDrieSet')}',$,'Pset_Keten',$,(#9004));`,
    `#9006=IFCRELDEFINESBYPROPERTIES('${fixtureGuid('1RegelDrieRel')}',$,$,$,(#393),#9005);`,
    '#9007=IFCPROPERTYSINGLEVALUE(\'Opmerking\',$,IFCLABEL(\'blijft\'),$);',
    `#9008=IFCPROPERTYSET('${fixtureGuid('1RegelVierSet')}',$,'Pset_Los',$,(#9007));`,
    `#9009=IFCRELDEFINESBYPROPERTIES('${fixtureGuid('1RegelVierRel')}',$,$,$,(#51),#9008);`,
  ].join('\n') + '\n' + content.slice(end);
}
