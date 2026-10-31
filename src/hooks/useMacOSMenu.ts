import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuItemOptions, SubmenuOptions } from '@tauri-apps/api/menu';
import { isTauri } from '@/utils/platform';
import { isMacPlatform } from '@/hooks/keyboard/shortcutFormat';
import { openNativeSettings, runNativeShortcut, type NativeShortcutId } from '@/hooks/keyboard/nativeMenuActions';
import { appLog } from '@/services/debug/appLog';

// De native macOS-menubalk is een tweede ingang naar dezelfde planneracties. Het lint blijft
// beschikbaar; de browser en Windows/Linux krijgen geen native menu of extra Tauri-import.
export function useMacOSMenu(): void {
  const { t } = useTranslation(['menu', 'common']);
  useEffect(() => {
    if (!isTauri() || !isMacPlatform()) return;
    let disposed = false;
    let close: (() => Promise<void>) | undefined;
    const command = (id: NativeShortcutId, text: string, accelerator?: string): MenuItemOptions => ({
      id: `ops.${id}`, text, accelerator,
      action: () => { if (!disposed) runNativeShortcut(id); },
    });
    void (async () => {
      const { Menu, Submenu } = await import('@tauri-apps/api/menu');
      if (disposed) return;
      const items: SubmenuOptions[] = [
        { text: 'Open Planner Studio', items: [
          { item: { About: { name: 'Open Planner Studio', version: __APP_VERSION__ } } },
          { item: 'Separator' },
          { id: 'ops.settings', text: t('menu:ribbon.settings'), accelerator: 'Cmd+,',
            action: () => { if (!disposed) openNativeSettings(); } },
          { item: 'Separator' }, { item: 'Services' }, { item: 'Separator' },
          { item: 'Hide' }, { item: 'HideOthers' }, { item: 'ShowAll' },
          { item: 'Separator' },
          { id: 'ops.quit', text: t('menu:native.quit'), accelerator: 'Cmd+Q', action: () => {
            if (disposed) return;
            // Via CloseRequested: dezelfde opslagvraag als de rode vensterknop.
            void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().close())
              .catch(error => appLog.emit('error', 'native-menu', error));
          } },
        ] },
        { text: t('menu:ribbon.file'), items: [
          command('file.newProject', t('menu:commands.newProject'), 'Cmd+N'),
          command('file.open', t('menu:ribbon.open'), 'Cmd+O'),
          { item: 'Separator' },
          command('file.save', t('menu:ribbon.save'), 'Cmd+S'),
          command('file.saveAs', t('menu:backstage.saveAs'), 'Cmd+Shift+S'),
          { item: 'Separator' },
          command('nav.reportTab', t('menu:ribbon.print'), 'Cmd+P'),
          { item: 'Separator' }, { item: 'CloseWindow' },
        ] },
        { text: t('menu:ribbon.edit'), items: [
          command('edit.undo', t('menu:commands.undo'), 'Cmd+Z'),
          command('edit.redoShiftZ', t('menu:commands.redo'), 'Cmd+Shift+Z'),
          { item: 'Separator' },
          // Native clipboardacties bereiken ook de copy/paste-listeners van het taakgrid.
          { item: 'Cut' }, { item: 'Copy' }, { item: 'Paste' }, { item: 'SelectAll' },
        ] },
        { text: t('menu:ribbon.planning'), items: [
          command('file.recalculate', t('menu:ribbon.calculate'), 'F5'),
        ] },
        { text: t('menu:ribbon.view'), items: [
          command('view.zoomIn', t('menu:commands.zoomIn'), 'Cmd+='),
          command('view.zoomOut', t('menu:commands.zoomOut'), 'Cmd+-'),
          { item: 'Separator' },
          command('view.toggleFullscreen', t('menu:ribbon.presentationMode'), 'F11'),
          { item: 'Fullscreen' },
        ] },
        { id: 'ops.window', text: t('menu:native.window'), items: [
          { item: 'Minimize' }, { item: 'Maximize' }, { item: 'Separator' }, { item: 'BringAllToFront' },
        ] },
        { id: 'ops.help', text: t('menu:backstage.help'), items: [
          command('nav.help', t('menu:backstage.help'), 'F1'),
          command('view.showShortcuts', t('common:shortcuts.view.showShortcuts'), 'Cmd+/'),
        ] },
      ];
      const menu = await Menu.new({ items });
      if (disposed) { await menu.close(); return; }
      // macOS voegt zo de open vensters en de native Help-zoekfunctie toe.
      for (const id of ['ops.window', 'ops.help']) {
        const submenu = await menu.get(id);
        if (submenu instanceof Submenu) {
          if (id === 'ops.window') await submenu.setAsWindowsMenuForNSApp();
          else await submenu.setAsHelpMenuForNSApp();
          await submenu.close();
        }
      }
      if (disposed) { await menu.close(); return; }
      // Sluit het vervangen handle, niet het menu dat de app zojuist overneemt.
      const previous = await menu.setAsAppMenu();
      await previous?.close();
      close = () => menu.close();
      if (disposed) await close();
    })().catch(error => appLog.emit('error', 'native-menu', error));
    return () => { disposed = true; void close?.().catch(error => appLog.emit('error', 'native-menu', error)); };
  }, [t]);
}
