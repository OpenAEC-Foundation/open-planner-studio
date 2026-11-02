// Keuze tussen twee grijzen voor titelbalk en documentbalk in licht, alleen voor de check van
// Ethan op de dev-server (PR #721). `?grijs=b` zet variant B; zonder parameter (of `?grijs=a`)
// blijft A uit globals.css staan. Valt uit elke productiebouw: main.tsx importeert deze module
// alleen dynamisch achter `import.meta.env.DEV`. Verdwijnt zodra Ethan gekozen heeft.
//
//   A  titelbalk #F4F4F5 (L* 96,2)  documentbalk #E9E9EC (L* 92,4)  — zoals nu in globals.css
//   B  titelbalk #EEEEEF (L* 94,1)  documentbalk #E3E3E6 (L* 90,3)  — even licht als de crème
//      #F1EEEA (L* 94,2), met dezelfde stap van 3,8 L* tussen titelbalk en documentbalk als A.
export const GREY_B = { titlebar: '#EEEEEF', docbar: '#E3E3E6' } as const;

export function installDevGreyChoice(choice: string | null): void {
  if (choice !== 'b') return;
  const style = document.createElement('style');
  style.dataset.opsDevGrey = 'b';
  // `html` erbij: wint van het lichte brugblok, ongeacht de volgorde van de stylesheets.
  style.textContent = `html[data-oa-theme="light"] { --theme-titlebar-bg: ${GREY_B.titlebar}; --theme-docbar-bg: ${GREY_B.docbar}; }`;
  document.head.appendChild(style);
}
