import { button, clear, element, setHidden } from './dom';
import type { BootViewModel, MainMenuViewModel } from './types';

interface BootViewActions {
  retry(): void;
  openHelp(): void;
}

export class BootView {
  readonly element: HTMLElement;

  private readonly eyebrow: HTMLElement;
  private readonly title: HTMLElement;
  private readonly message: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly progressWrap: HTMLElement;
  private readonly progress: HTMLProgressElement;
  private readonly progressLabel: HTMLElement;
  private readonly retryButton: HTMLButtonElement;
  private readonly helpButton: HTMLButtonElement;

  constructor(actions: BootViewActions) {
    this.eyebrow = element('p', 'screen-eyebrow', 'Systemstart');
    this.title = element('h1', 'boot-screen__title', 'Stranded 2');
    this.message = element('p', 'boot-screen__message', 'Die Gezeiten werden berechnet …');
    this.detail = element('p', 'boot-screen__detail');

    this.progress = element('progress', 'boot-screen__progress');
    this.progress.max = 1;
    this.progress.value = 0;
    this.progress.setAttribute('aria-label', 'Ladefortschritt');
    this.progressLabel = element('span', 'boot-screen__progress-label', 'Vorbereitung');
    this.progressWrap = element(
      'div',
      'boot-screen__progress-wrap',
      this.progress,
      this.progressLabel,
    );

    this.retryButton = button('Erneut versuchen', 'button button--primary', actions.retry);
    this.helpButton = button('Kompatibilität prüfen', 'button button--quiet', actions.openHelp);
    const actionsWrap = element(
      'div',
      'button-row boot-screen__actions',
      this.retryButton,
      this.helpButton,
    );

    const card = element(
      'div',
      'screen-card boot-screen__card',
      this.eyebrow,
      this.title,
      this.message,
      this.detail,
      this.progressWrap,
      actionsWrap,
    );
    this.element = element('section', 'ui-screen boot-screen', card);
    this.element.setAttribute('aria-labelledby', 'boot-screen-title');
    this.title.id = 'boot-screen-title';
    this.update({ mode: 'booting' });
  }

  update(model: BootViewModel): void {
    const isFatal = model.mode === 'fatal-webgl';
    this.element.dataset.mode = model.mode;
    this.eyebrow.textContent = isFatal
      ? 'Grafiksystem nicht verfügbar'
      : model.mode === 'loading'
        ? 'Expedition wird geladen'
        : 'Systemstart';
    this.title.textContent = model.title ?? (isFatal ? 'WebGL wird benötigt' : 'Stranded 2');
    this.message.textContent =
      model.message ??
      (isFatal
        ? 'Dein Browser konnte keine kompatible 3D-Grafikumgebung starten.'
        : 'Die Gezeiten werden berechnet …');
    this.detail.textContent = model.detail ?? '';
    setHidden(this.detail, !model.detail);

    const progress = Math.min(1, Math.max(0, model.progress ?? 0));
    this.progress.value = progress;
    this.progressLabel.textContent =
      model.progressLabel ?? (model.mode === 'booting' ? 'Vorbereitung' : `${Math.round(progress * 100)} %`);
    setHidden(this.progressWrap, isFatal);
    setHidden(this.retryButton, !isFatal || !model.canRetry);
    setHidden(this.helpButton, !isFatal || !model.canOpenHelp);
  }
}

interface MainMenuActions {
  continueGame(): void;
  newGame(): void;
  openSettings(): void;
  openCredits(): void;
}

export class MainMenuView {
  readonly element: HTMLElement;

  private readonly continueButton: HTMLButtonElement;
  private readonly continueMeta: HTMLElement;
  private readonly version: HTMLElement;

  constructor(actions: MainMenuActions) {
    const brand = element(
      'header',
      'main-menu__brand',
      element('p', 'screen-eyebrow', 'Überleben beginnt am Horizont'),
      element('h1', 'main-menu__title', 'Stranded', element('span', '', '2')),
      element(
        'p',
        'main-menu__tagline',
        'Ferne Inseln. Ein Ozean. Baue, überlebe und finde einen Weg durch die Strömung.',
      ),
    );

    this.continueMeta = element('span', 'menu-action__meta');
    this.continueButton = button('', 'menu-action menu-action--primary', actions.continueGame);
    this.continueButton.replaceChildren(
      element('span', 'menu-action__label', 'Fortsetzen'),
      this.continueMeta,
    );

    const navigation = element(
      'nav',
      'main-menu__actions',
      this.continueButton,
      button('Neues Spiel', 'menu-action', actions.newGame),
      button('Einstellungen', 'menu-action', actions.openSettings),
      button('Credits', 'menu-action', actions.openCredits),
    );
    navigation.setAttribute('aria-label', 'Hauptmenü');

    this.version = element('p', 'main-menu__version');
    const card = element('div', 'main-menu__content', brand, navigation, this.version);
    const horizon = element('div', 'main-menu__horizon');
    horizon.setAttribute('aria-hidden', 'true');
    this.element = element('section', 'ui-screen main-menu', horizon, card);
    this.element.setAttribute('aria-labelledby', 'main-menu-title');
    brand.querySelector('h1')!.id = 'main-menu-title';
    this.update({ canContinue: false });
  }

  update(model: MainMenuViewModel): void {
    this.continueButton.disabled = !model.canContinue;
    const summary = model.continueSummary;
    clear(this.continueMeta);
    if (summary) {
      this.continueMeta.textContent = `${summary.islandName} · ${summary.playedFor} · ${summary.savedAt}`;
      this.continueButton.setAttribute(
        'aria-label',
        `Fortsetzen: ${summary.islandName}, Spielzeit ${summary.playedFor}, gespeichert ${summary.savedAt}`,
      );
    } else {
      this.continueMeta.textContent = model.canContinue ? 'Letzten Spielstand laden' : 'Kein Spielstand vorhanden';
      this.continueButton.setAttribute('aria-label', 'Fortsetzen');
    }
    this.version.textContent = model.versionLabel ?? '';
    setHidden(this.version, !model.versionLabel);
  }
}
