import {
  cardinalDirection,
  clamp,
  clear,
  element,
  normalizeDegrees,
  percentage,
  setHidden,
} from './dom';
import type {
  HudMapViewModel,
  HotbarSlotViewModel,
  HudViewModel,
  SurvivalMetricViewModel,
} from './types';
import { clampMapPoint, createMapProjection } from './mapProjection';

interface HudActions {
  selectHotbar(index: number, itemId?: string): void;
}

interface MetricElements {
  root: HTMLElement;
  value: HTMLElement;
  bar: HTMLElement;
}

const METRIC_DEFINITIONS = [
  ['health', 'Gesundheit', '♥'],
  ['hunger', 'Hunger', '◆'],
  ['thirst', 'Durst', '●'],
  ['stamina', 'Ausdauer', '↯'],
  ['oxygen', 'Sauerstoff', '○'],
  ['fatigue', 'Müdigkeit', '☾'],
] as const;

export class HudView {
  readonly element: HTMLElement;

  private readonly metrics = new Map<string, MetricElements>();
  private readonly compassBearing: HTMLElement;
  private readonly compassNeedle: HTMLElement;
  private readonly compassLocation: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptKey: HTMLElement;
  private readonly promptKeyIcon: HTMLImageElement;
  private readonly promptKeyText: HTMLElement;
  private readonly promptAction: HTMLElement;
  private readonly promptTarget: HTMLElement;
  private readonly promptHold: HTMLElement;
  private readonly messages: HTMLElement;
  private readonly hotbar: HTMLElement;
  private readonly mapSvg: SVGSVGElement;
  private readonly mapLocation: HTMLElement;
  private readonly map: HTMLElement;
  private readonly actions: HudActions;

  constructor(actions: HudActions) {
    this.actions = actions;

    const metricList = element('ul', 'survival-metrics');
    metricList.setAttribute('aria-label', 'Überlebenswerte');
    for (const [, label, icon] of METRIC_DEFINITIONS) {
      const value = element('span', 'survival-metric__value', '—');
      const bar = element('span', 'survival-metric__bar-fill');
      const barTrack = element('span', 'survival-metric__bar', bar);
      barTrack.setAttribute('aria-hidden', 'true');
      const root = element(
        'li',
        'survival-metric',
        element('span', 'survival-metric__icon', icon),
        element(
          'span',
          'survival-metric__content',
          element('span', 'survival-metric__label', label),
          barTrack,
        ),
        value,
      );
      root.dataset.metric = label.toLowerCase();
      metricList.append(root);
      this.metrics.set(label, { root, value, bar });
    }

    this.compassBearing = element('strong', 'compass__bearing', 'N · 000°');
    this.compassNeedle = element('span', 'compass__needle', '▲');
    this.compassNeedle.setAttribute('aria-hidden', 'true');
    this.compassLocation = element('span', 'compass__location', 'Unbekannte Gewässer');
    const compass = element(
      'div',
      'compass',
      element('span', 'compass__rule', 'W', ' · ', 'NW', ' · ', 'N', ' · ', 'NO', ' · ', 'O'),
      this.compassNeedle,
      this.compassBearing,
      this.compassLocation,
    );
    compass.setAttribute('role', 'status');
    compass.setAttribute('aria-label', 'Kompass');

    this.clock = element('span', 'hud-clock');
    const top = element(
      'header',
      'hud-top',
      element('div', 'hud-top__left', metricList),
      compass,
      this.clock,
    );

    this.promptKeyIcon = document.createElement('img');
    this.promptKeyIcon.className = 'interaction-prompt__key-icon';
    this.promptKeyIcon.alt = '';
    this.promptKeyIcon.setAttribute('aria-hidden', 'true');
    this.promptKeyText = element('span', 'interaction-prompt__key-text', 'E');
    this.promptKey = element('kbd', 'interaction-prompt__key', this.promptKeyIcon, this.promptKeyText);
    this.promptAction = element('strong', 'interaction-prompt__action', 'Interagieren');
    this.promptTarget = element('span', 'interaction-prompt__target');
    this.promptHold = element('span', 'interaction-prompt__hold-fill');
    const holdTrack = element('span', 'interaction-prompt__hold', this.promptHold);
    holdTrack.setAttribute('aria-hidden', 'true');
    this.prompt = element(
      'div',
      'interaction-prompt',
      this.promptKey,
      element('span', 'interaction-prompt__copy', this.promptAction, this.promptTarget),
      holdTrack,
    );

    this.messages = element('ol', 'hud-messages');
    this.messages.setAttribute('aria-live', 'polite');
    this.messages.setAttribute('aria-label', 'Spielmeldungen');

    this.hotbar = element('ol', 'hotbar');
    this.hotbar.setAttribute('aria-label', 'Schnellzugriff');
    const bottom = element('footer', 'hud-bottom', this.messages, this.hotbar);

    this.mapSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.mapSvg.classList.add('hud-map__svg');
    this.mapSvg.setAttribute('viewBox', '0 0 320 190');
    this.mapSvg.setAttribute('role', 'img');
    this.mapLocation = element('span', 'hud-map__location', 'Unbekannte Gewässer');
    this.map = element(
      'aside',
      'hud-map',
      element('header', 'hud-map__header', element('strong', '', 'Archipelkarte'), element('span', '', 'M · Einstecken')),
      this.mapSvg,
      element('footer', 'hud-map__footer', element('span', 'hud-map__legend', '▲ Du'), this.mapLocation),
    );
    this.map.setAttribute('aria-label', 'Hervorgeholte Archipelkarte mit aktuellem Standort');

    const crosshair = element('span', 'hud-crosshair');
    crosshair.setAttribute('aria-hidden', 'true');
    this.element = element('section', 'game-hud', top, this.map, crosshair, this.prompt, bottom);
    this.element.setAttribute('aria-label', 'Spielanzeige');
    setHidden(this.prompt, true);
    setHidden(this.clock, true);
  }

  update(model: HudViewModel): void {
    const metrics: ReadonlyArray<[string, SurvivalMetricViewModel]> = [
      ['Gesundheit', model.health],
      ['Hunger', model.hunger],
      ['Durst', model.thirst],
      ['Ausdauer', model.stamina],
      ['Sauerstoff', model.oxygen],
      ['Müdigkeit', model.fatigue],
    ];
    for (const [label, metric] of metrics) this.updateMetric(label, metric);

    const heading = normalizeDegrees(model.headingDegrees);
    this.compassBearing.textContent = `${cardinalDirection(heading)} · ${String(Math.round(heading)).padStart(3, '0')}°`;
    this.compassLocation.textContent = model.locationLabel ?? 'Unbekannte Gewässer';
    this.compassNeedle.style.setProperty('--heading', `${-heading}deg`);

    this.clock.textContent = model.clockLabel ?? '';
    setHidden(this.clock, !model.clockLabel);
    this.updatePrompt(model);
    this.updateMessages(model);
    this.updateHotbar(model.hotbar, model.selectedHotbarIndex);
    setHidden(this.map, !model.map.visible);
    this.updateMap(model.map);
  }

  private updateMap(model: HudMapViewModel): void {
    clear(this.mapSvg);
    const expanded = model.islands.some((island) => island.id === 'rieseninsel');
    this.map.dataset.expanded = String(expanded);
    this.mapSvg.setAttribute('viewBox', expanded ? '0 0 640 190' : '0 0 320 190');
    this.mapSvg.style.aspectRatio = expanded ? '640 / 190' : '320 / 190';
    const panels = expanded
      ? [{ islands: model.islands.filter((island) => island.id !== 'rieseninsel'), offset: 0, overview: false },
         { islands: model.islands, offset: 320, overview: true }]
      : [{ islands: model.islands, offset: 0, overview: false }];
    const ns = 'http://www.w3.org/2000/svg';
    for (const panel of panels) {
    const projection = createMapProjection(panel.islands, 320, 190);
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('transform', 'translate(' + panel.offset + ' 0)');
    layer.setAttribute('aria-label', panel.overview ? 'Fernreise zur Rieseninsel' : 'Bekanntes Archipel');
    this.mapSvg.append(layer);

    const ocean = document.createElementNS(ns, 'rect');
    ocean.setAttribute('class', 'hud-map__ocean');
    ocean.setAttribute('width', '320');
    ocean.setAttribute('height', '190');
    layer.append(ocean);

    const north = document.createElementNS(ns, 'text');
    north.setAttribute('class', 'hud-map__north');
    north.setAttribute('x', '160');
    north.setAttribute('y', '11');
    north.textContent = 'N';
    layer.append(north);

    for (const island of panel.islands) {
      const center = projection.project(island.x, island.z);
      const shape = document.createElementNS(ns, 'ellipse');
      shape.setAttribute('class', 'hud-map__island');
      shape.setAttribute('cx', center.x.toFixed(2));
      shape.setAttribute('cy', center.y.toFixed(2));
      shape.setAttribute('rx', Math.max(2.4, projection.scaleLength(island.width / 2)).toFixed(2));
      shape.setAttribute('ry', Math.max(1.8, projection.scaleLength(island.depth / 2)).toFixed(2));
      shape.dataset.start = String(island.isStart);
      shape.dataset.current = String(island.isCurrent);
      layer.append(shape);
      const title = document.createElementNS(ns, "title"); title.textContent = island.label; shape.append(title);

      const label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 'hud-map__island-label');
      label.setAttribute('x', center.x.toFixed(2));
      label.setAttribute('y', (center.y - Math.max(3.2, projection.scaleLength(island.depth / 2)) - 2).toFixed(2));
      label.dataset.current = String(island.isCurrent);
      label.textContent = island.label;
      if (!panel.overview || island.isCurrent || island.isStart || island.id === 'rieseninsel') layer.append(label);
      if (island.id === 'rieseninsel') {
        const lake = document.createElementNS(ns, 'ellipse');
        lake.setAttribute('cx', center.x.toFixed(2)); lake.setAttribute('cy', center.y.toFixed(2));
        lake.setAttribute('rx', projection.scaleLength(180).toFixed(2)); lake.setAttribute('ry', projection.scaleLength(135).toFixed(2));
        lake.setAttribute('fill', '#42a6b6'); layer.append(lake);
      }
    }

    const projectedPlayer = clampMapPoint(projection.project(model.playerX, model.playerZ), 320, 190);
    const player = document.createElementNS(ns, 'polygon');
    player.setAttribute('class', 'hud-map__player');
    player.setAttribute('points', '0,-7 5.5,6 0,3 -5.5,6');
    player.setAttribute('transform', `translate(${projectedPlayer.x.toFixed(2)} ${projectedPlayer.y.toFixed(2)}) rotate(${normalizeDegrees(model.headingDegrees).toFixed(1)})`);
    layer.append(player);
    }

    this.mapLocation.textContent = model.locationLabel;
    this.mapSvg.setAttribute('aria-label', `Karte. Du bist bei ${model.locationLabel} und blickst ${cardinalDirection(model.headingDegrees)}.`);
  }

  private updateMetric(label: string, metric: SurvivalMetricViewModel): void {
    const ui = this.metrics.get(label);
    if (!ui) return;
    const ratio = percentage(metric.current, metric.max);
    ui.bar.style.setProperty('--value', `${ratio * 100}%`);
    ui.value.textContent = metric.display ?? `${Math.round(metric.current)}`;
    ui.root.dataset.state = metric.state ?? (ratio <= 0.2 ? 'critical' : ratio <= 0.4 ? 'warning' : 'good');
    ui.root.setAttribute(
      'aria-label',
      `${label}: ${metric.display ?? `${Math.round(metric.current)} von ${Math.round(metric.max)}`}`,
    );
  }

  private updatePrompt(model: HudViewModel): void {
    const prompt = model.prompt;
    setHidden(this.prompt, !prompt);
    if (!prompt) return;
    const iconFile = prompt.key === 'E'
      ? 'keyboard_e.svg'
      : prompt.key === 'LMB'
        ? 'mouse_left.svg'
        : null;
    this.promptKeyText.textContent = prompt.key;
    this.promptKey.dataset.icon = String(Boolean(iconFile));
    setHidden(this.promptKeyText, Boolean(iconFile));
    setHidden(this.promptKeyIcon, !iconFile);
    if (iconFile) this.promptKeyIcon.src = new URL(`assets/third-party/kenney/input-prompts/icons/${iconFile}`, document.baseURI).href;
    this.promptAction.textContent = prompt.action;
    this.promptTarget.textContent = prompt.target ? ` ${prompt.target}` : '';
    const hold = prompt.holdProgress;
    this.promptHold.style.setProperty('--value', `${clamp(hold ?? 0) * 100}%`);
    this.prompt.classList.toggle('interaction-prompt--holding', hold !== undefined);
    this.prompt.setAttribute(
      'aria-label',
      `${prompt.key}: ${prompt.action}${prompt.target ? `, ${prompt.target}` : ''}`,
    );
  }

  private updateMessages(model: HudViewModel): void {
    clear(this.messages);
    for (const message of (model.messages ?? []).slice(-4)) {
      const item = element('li', 'hud-message', message.text);
      item.dataset.tone = message.tone ?? 'info';
      item.dataset.messageId = message.id;
      this.messages.append(item);
    }
  }

  private updateHotbar(slots: readonly HotbarSlotViewModel[], selectedIndex: number): void {
    clear(this.hotbar);
    for (const slot of slots) {
      const indexLabel = element('span', 'hotbar-slot__index', String(slot.index + 1));
      const icon = element('span', 'hotbar-slot__icon', slot.iconText ?? '');
      const label = element('span', 'hotbar-slot__label', slot.label ?? 'Leer');
      const quantity = element(
        'span',
        'hotbar-slot__quantity',
        slot.quantity !== undefined && slot.quantity > 1 ? String(slot.quantity) : '',
      );
      const durability = element('span', 'hotbar-slot__durability');
      durability.style.setProperty('--value', `${clamp(slot.durability ?? 0) * 100}%`);
      setHidden(durability, slot.durability === undefined);

      const control = element(
        'button',
        'hotbar-slot',
        indexLabel,
        icon,
        label,
        quantity,
        durability,
      );
      control.type = 'button';
      control.disabled = slot.disabled ?? false;
      control.dataset.selected = String(slot.index === selectedIndex);
      control.setAttribute('aria-pressed', String(slot.index === selectedIndex));
      control.setAttribute(
        'aria-label',
        `${slot.index + 1}: ${slot.label ?? 'Leer'}${slot.quantity ? `, Anzahl ${slot.quantity}` : ''}`,
      );
      control.addEventListener('click', () => this.actions.selectHotbar(slot.index, slot.itemId));
      this.hotbar.append(element('li', 'hotbar__item', control));
    }
  }
}
