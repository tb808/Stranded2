import {
  button,
  clear,
  element,
  focusFirst,
  safeDialogClose,
  safeDialogOpen,
} from './dom';
import type {
  DeathViewModel,
  LetterViewModel,
  PauseViewModel,
  QualityPreset,
  SettingsViewModel,
  StorageErrorViewModel,
  UiModal,
} from './types';

interface ModalActions {
  requestClose(): void;
  resume(): void;
  openSettings(): void;
  returnToMainMenu(): void;
  reloadLastSave(): void;
  restartAfterDeath(): void;
  settingsChanged(settings: SettingsViewModel): void;
  storageRetry(): void;
  continueWithoutSaving(): void;
  storageDismissed(): void;
}

export class ModalView {
  readonly element: HTMLDialogElement;

  private readonly content: HTMLElement;
  private readonly actions: ModalActions;
  private activeModal: UiModal | null = null;

  constructor(actions: ModalActions) {
    this.actions = actions;
    this.content = element('div', 'ui-modal__content');
    this.element = element('dialog', 'ui-modal', this.content);
    this.element.setAttribute('aria-labelledby', 'ui-modal-title');
    this.element.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.actions.requestClose();
    });
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element && this.activeModal !== 'death') {
        this.actions.requestClose();
      }
    });
  }

  getActiveModal(): UiModal | null {
    return this.activeModal;
  }

  close(): void {
    this.activeModal = null;
    delete this.element.dataset.modal;
    safeDialogClose(this.element);
  }

  showLetter(model: LetterViewModel): void {
    this.activeModal = 'letter';
    clear(this.content);
    this.element.dataset.modal = 'letter';

    const close = button('Schließen', 'letter-view__close', this.actions.requestClose);
    close.setAttribute('aria-label', 'Brief schließen');
    const article = element(
      'article',
      'letter-view',
      close,
      element('p', 'letter-view__eyebrow', `Gefundener Brief · ${model.sequence} von ${model.total}`),
      element('h2', 'letter-view__title', model.title),
      element(
        'div',
        'letter-view__meta',
        element('span', '', model.dateLabel),
        element('span', '', model.locationLabel),
      ),
      element(
        'div',
        'letter-view__body',
        ...model.paragraphs.map((paragraph) => element('p', '', paragraph)),
      ),
      element('p', 'letter-view__signature', model.signature),
      element('p', 'letter-view__hint', 'Esc oder × zum Schließen'),
      element('span', 'letter-view__seal', 'E'),
    );
    article.querySelector('h2')!.id = 'ui-modal-title';
    this.content.append(article);
    safeDialogOpen(this.element);
    requestAnimationFrame(() => focusFirst(this.content));
  }

  showPause(model: PauseViewModel = {}): void {
    this.activeModal = 'pause';
    const saveLabel =
      model.saveStatus === 'saving'
        ? 'Speichert …'
        : model.saveStatus === 'unavailable'
          ? 'Speichern nicht verfügbar'
          : 'Spielstand aktuell';
    const meta = element(
      'div',
      'pause-meta',
      model.locationLabel ? element('span', '', model.locationLabel) : null,
      model.playedFor ? element('span', '', `Spielzeit ${model.playedFor}`) : null,
      element('span', 'pause-meta__save', saveLabel),
    );
    this.render(
      'Pausiert',
      'Die Brandung wartet.',
      element(
        'div',
        'modal-menu',
        button('Weiterspielen', 'menu-action menu-action--primary', this.actions.resume),
        button('Einstellungen', 'menu-action', this.actions.openSettings),
        button('Zum Hauptmenü', 'menu-action menu-action--danger', this.actions.returnToMainMenu),
      ),
      meta,
    );
  }

  showCredits(): void {
    this.activeModal = 'credits';
    const externalLink = (label: string, href: string): HTMLAnchorElement => {
      const link = element('a', 'credits__link', label);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    };
    const credits = element(
      'div',
      'credits',
      element(
        'section',
        'credits__section',
        element('h3', '', 'Eine einsame Expedition'),
        element(
          'p',
          '',
          'Stranded 2 ist ein tropisches Survival-Abenteuer über Einfallsreichtum, Entdeckung und den Weg über das offene Meer.',
        ),
      ),
      element(
        'section',
        'credits__section',
        element('h3', '', 'Entwicklung'),
        element('p', '', 'Konzept, Design und Entwicklung: Stranded-2-Team'),
        element('p', '', 'Mit Dank an alle Testenden und Inselkundschafter.'),
      ),
      element(
        'section',
        'credits__section',
        element('h3', '', 'Assets und Audio'),
        element(
          'p',
          '',
          'Ausgewählte Modelle, Eingabehinweise und Sounds stammen von ',
          externalLink('Kenney', 'https://kenney.nl/'),
          ' und stehen unter ',
          externalLink('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
          '.',
        ),
        element(
          'ul',
          'credits__sources',
          element('li', '', externalLink('Nature Kit 2.1', 'https://kenney.nl/assets/nature-kit')),
          element('li', '', externalLink('Survival Kit 2.0', 'https://kenney.nl/assets/survival-kit')),
          element('li', '', externalLink('Input Prompts 1.5a', 'https://kenney.nl/assets/input-prompts')),
          element('li', '', externalLink('Impact Sounds', 'https://kenney.nl/assets/impact-sounds')),
          element('li', '', externalLink('Interface Sounds', 'https://kenney.nl/assets/interface-sounds')),
          element('li', '', externalLink('Quaternius Cube World Kit und Vogel (CC0)', 'https://quaternius.com/')),
        ),
      ),
      element(
        'section',
        'credits__section',
        element('h3', '', 'CC-BY-Modelle'),
        element(
          'p',
          '',
          'Schildkröte und Krokodil von jeremy, bereitgestellt über ',
          externalLink('Poly Pizza', 'https://poly.pizza/'),
          ', lizenziert unter ',
          externalLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
          '.',
        ),
        element(
          'p',
          '',
          'Die Vulkan-Landmarke „Volcano“ von Poly by Google wurde über ',
          externalLink('Poly Pizza', 'https://poly.pizza/m/dwSigTeSMCo'),
          ' bezogen und steht unter ',
          externalLink('CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'),
          '.',
        ),
      ),
      button('Zurück', 'button button--primary', this.actions.requestClose),
    );
    this.render('Credits', 'Jede Reise beginnt mit einer Idee.', credits);
  }

  showSettings(model: SettingsViewModel): void {
    this.activeModal = 'settings';
    const form = element('form', 'settings-form');
    form.addEventListener('submit', (event) => event.preventDefault());

    const quality = element('select', 'settings-control__select');
    quality.id = 'setting-quality';
    const qualityOptions: ReadonlyArray<[QualityPreset, string]> = [
      ['low', 'Niedrig'],
      ['medium', 'Mittel'],
      ['high', 'Hoch'],
      ['ultra', 'Ultra'],
    ];
    for (const [value, label] of qualityOptions) {
      const option = element('option', '', label);
      option.value = value;
      option.selected = model.quality === value;
      quality.append(option);
    }

    const draft: SettingsViewModel = {
      ...model,
      audio: { ...model.audio },
    };
    quality.addEventListener('change', () => {
      draft.quality = quality.value as QualityPreset;
      this.actions.settingsChanged(cloneSettings(draft));
    });

    const graphics = element(
      'fieldset',
      'settings-group',
      element('legend', '', 'Darstellung'),
      this.settingRow(
        'Grafikqualität',
        'Schatten, Sichtweite und Effektdichte',
        quality,
        'setting-quality',
      ),
      this.rangeSetting(
        'Sichtfeld',
        'Horizontales Kamerasichtfeld',
        'setting-fov',
        60,
        100,
        1,
        draft.fov,
        '°',
        (value) => {
          draft.fov = value;
          this.actions.settingsChanged(cloneSettings(draft));
        },
      ),
      this.rangeSetting(
        'Mausempfindlichkeit',
        'Drehgeschwindigkeit der Kamera',
        'setting-sensitivity',
        0.1,
        3,
        0.1,
        draft.sensitivity,
        '×',
        (value) => {
          draft.sensitivity = value;
          this.actions.settingsChanged(cloneSettings(draft));
        },
      ),
    );

    const audio = element('fieldset', 'settings-group', element('legend', '', 'Audio'));
    const audioControls: ReadonlyArray<[
      keyof SettingsViewModel['audio'],
      string,
      string,
    ]> = [
      ['master', 'Gesamtlautstärke', 'Alle Klänge'],
      ['ambience', 'Umgebung', 'Wind, Meer und Tierwelt'],
      ['effects', 'Effekte', 'Werkzeuge, Schritte und Interaktionen'],
      ['ui', 'Menüklänge', 'Bestätigungen und Hinweise'],
    ];
    for (const [key, label, description] of audioControls) {
      audio.append(
        this.rangeSetting(
          label,
          description,
          `setting-audio-${key}`,
          0,
          100,
          1,
          Math.round(draft.audio[key] * 100),
          '%',
          (value) => {
            draft.audio[key] = value / 100;
            this.actions.settingsChanged(cloneSettings(draft));
          },
        ),
      );
    }

    const reducedMotion = element('input', 'settings-toggle__input');
    reducedMotion.type = 'checkbox';
    reducedMotion.id = 'setting-reduced-motion';
    reducedMotion.checked = draft.reducedMotion;
    reducedMotion.addEventListener('change', () => {
      draft.reducedMotion = reducedMotion.checked;
      this.actions.settingsChanged(cloneSettings(draft));
    });
    const accessibility = element(
      'fieldset',
      'settings-group',
      element('legend', '', 'Zugänglichkeit'),
      element(
        'label',
        'settings-toggle',
        element(
          'span',
          'settings-control__copy',
          element('strong', '', 'Bewegungen reduzieren'),
          element('small', '', 'Menüanimationen und dekorative Bewegung minimieren'),
        ),
        reducedMotion,
        element('span', 'settings-toggle__visual'),
      ),
    );

    form.append(
      graphics,
      audio,
      accessibility,
      element(
        'div',
        'settings-form__footer',
        element('p', '', 'Änderungen werden sofort angewendet.'),
        button('Zurück', 'button button--primary', this.actions.requestClose),
      ),
    );
    this.render('Einstellungen', 'Passe die Expedition an dein System und deine Spielweise an.', form);
  }

  showDeath(model: DeathViewModel): void {
    this.activeModal = 'death';
    const stats = element(
      'dl',
      'death-stats',
      element('div', '', element('dt', '', 'Ursache'), element('dd', '', model.cause)),
      model.survivedFor
        ? element('div', '', element('dt', '', 'Überlebt'), element('dd', '', model.survivedFor))
        : null,
      model.islandName
        ? element('div', '', element('dt', '', 'Letzter Ort'), element('dd', '', model.islandName))
        : null,
    );
    const reload = button('Letzten Spielstand laden', 'button button--primary', this.actions.reloadLastSave);
    reload.disabled = !model.canReload;
    this.render(
      'Die Insel hat gewonnen',
      'Deine Reise endet hier – aber nicht jede Reise muss gleich verlaufen.',
      stats,
      element(
        'div',
        'button-row death-actions',
        reload,
        button('Neu beginnen', 'button button--quiet', this.actions.restartAfterDeath),
        button('Zum Hauptmenü', 'button button--ghost', this.actions.returnToMainMenu),
      ),
    );
  }

  showStorageError(model: StorageErrorViewModel): void {
    this.activeModal = 'storage-error';
    const defaultTitle =
      model.operation === 'quota'
        ? 'Speicherplatz erschöpft'
        : model.operation === 'load'
          ? 'Spielstand konnte nicht geladen werden'
          : 'Spielstand konnte nicht gespeichert werden';
    const actions = element('div', 'button-row storage-error__actions');
    if (model.canRetry) {
      actions.append(button('Erneut versuchen', 'button button--primary', this.actions.storageRetry));
    }
    if (model.canContinueWithoutSaving) {
      actions.append(
        button('Ohne Speichern fortfahren', 'button button--danger', this.actions.continueWithoutSaving),
      );
    }
    actions.append(button('Schließen', 'button button--quiet', this.actions.storageDismissed));

    this.render(
      model.title ?? defaultTitle,
      model.message,
      model.detail ? element('pre', 'storage-error__detail', model.detail) : null,
      actions,
    );
  }

  private render(title: string, intro: string, ...children: Array<Node | null>): void {
    clear(this.content);
    if (this.activeModal) this.element.dataset.modal = this.activeModal;
    const close = button('Schließen', 'icon-button ui-modal__close', this.actions.requestClose);
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dialog schließen');
    if (this.activeModal === 'death') close.hidden = true;
    const header = element(
      'header',
      'ui-modal__header',
      element(
        'div',
        '',
        element('p', 'screen-eyebrow', 'Stranded 2'),
        element('h2', 'ui-modal__title', title),
        element('p', 'ui-modal__intro', intro),
      ),
      close,
    );
    header.querySelector('h2')!.id = 'ui-modal-title';
    this.content.append(header, ...children.filter((child): child is Node => child !== null));
    safeDialogOpen(this.element);
    requestAnimationFrame(() => focusFirst(this.content));
  }

  private settingRow(
    label: string,
    description: string,
    control: HTMLElement,
    controlId: string,
  ): HTMLElement {
    const copy = element(
      'label',
      'settings-control__copy',
      element('strong', '', label),
      element('small', '', description),
    );
    copy.htmlFor = controlId;
    return element(
      'div',
      'settings-control',
      copy,
      control,
    );
  }

  private rangeSetting(
    label: string,
    description: string,
    id: string,
    min: number,
    max: number,
    step: number,
    value: number,
    suffix: string,
    onInput: (value: number) => void,
  ): HTMLElement {
    const input = element('input', 'settings-range');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const output = element('output', 'settings-range__value', `${value}${suffix}`);
    output.htmlFor = id;
    input.addEventListener('input', () => {
      const next = Number(input.value);
      output.value = `${next}${suffix}`;
      onInput(next);
    });
    const copy = element(
      'label',
      'settings-control__copy',
      element('strong', '', label),
      element('small', '', description),
    );
    copy.htmlFor = id;
    return element(
      'div',
      'settings-control',
      copy,
      element('div', 'settings-range-wrap', input, output),
    );
  }
}

function cloneSettings(settings: SettingsViewModel): SettingsViewModel {
  return {
    ...settings,
    audio: { ...settings.audio },
  };
}
