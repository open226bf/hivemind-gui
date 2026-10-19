import { describe, expect, it } from 'vitest';

import { PortDTO } from './models';
import { portLabel, portTitle, summarizePorts } from './ports';

const port = (over: Partial<PortDTO> = {}): PortDTO => ({
  target_port: 80,
  published_port: 8080,
  protocol: 'tcp',
  mode: 'ingress',
  ...over,
});

describe('portLabel', () => {
  it('reads published → container, leaving the default protocol unmarked', () => {
    expect(portLabel(port())).toBe('8080→80');
  });

  it('marks a protocol other than tcp', () => {
    expect(portLabel(port({ published_port: 5353, target_port: 53, protocol: 'udp' }))).toBe(
      '5353→53/udp',
    );
  });

  it('shows "auto" when the orchestrator picks the published port', () => {
    expect(portLabel(port({ published_port: 0, target_port: 9000 }))).toBe('auto→9000');
  });
});

describe('portTitle', () => {
  it('spells out how the port is published', () => {
    expect(portTitle(port())).toBe('TCP — port publié 8080 → conteneur 80 (routing mesh)');
    expect(portTitle(port({ mode: 'host' }))).toContain('mode hôte');
  });

  it('says so when the published port is automatic', () => {
    expect(portTitle(port({ published_port: 0 }))).toContain('attribué automatiquement');
  });
});

describe('summarizePorts', () => {
  const many = [80, 81, 82, 83, 84].map((n) => port({ target_port: n, published_port: n }));

  it('shows every port when they fit', () => {
    const s = summarizePorts(many.slice(0, 3));

    expect(s.shown).toHaveLength(3);
    expect(s.hidden).toEqual([]);
  });

  it('folds the overflow, keeping declared order', () => {
    const s = summarizePorts(many);

    expect(s.shown.map((c) => c.label)).toEqual(['80→80', '81→81', '82→82']);
    expect(s.hidden.map((c) => c.label)).toEqual(['83→83', '84→84']);
  });

  it('lists the folded ports one per line in the "+N" tooltip', () => {
    const lines = summarizePorts(many).hiddenTitle.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('83→83');
    expect(lines[1]).toContain('84→84');
  });

  it('copes with a service that publishes nothing, or no list at all', () => {
    const none = { shown: [], hidden: [], hiddenTitle: '' };
    expect(summarizePorts([])).toEqual(none);
    expect(summarizePorts(undefined)).toEqual(none);
  });
});
