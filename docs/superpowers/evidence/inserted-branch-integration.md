# Ingevoegde takken na de main-integratie

De workflow geeft de actuele PR-basis expliciet door als `PERF_BASE_REVISION`.
Het meetprogramma controleert de volledige SHA, voorouderschap en de productscope,
inclusief package- en lockfile. Alleen `insertedBranch.ts` wordt tussen de twee
verder gelijke actuele bundels verwisseld. De bestaande store-/undo-/document- en
weigeringvergelijkingen blijven behouden.

De aparte rode controle gebruikt eveneens de actuele basisbron. Zij moet uitsluitend
op de zes vooraf bepaalde leesbudgetten falen. De headbron wordt vooraf gekopieerd
naar een tijdelijk bestand en met `cp` teruggezet, ook bij fouten. Geen stash, reset,
checkout of restore wordt voor dit mutatiebewijs gebruikt. Historische tijden zijn
geen meetbewijs voor de nieuwe geïntegreerde head; dat bewijs moet uit de nieuwe CI komen.
