import { PortDTO } from './models';

/** One published port, ready to render: a short label for the cell and the full
 *  description for its tooltip. */
export interface PortChip {
  label: string;
  title: string;
}

export interface PortSummary {
  /** The first ports, shown as they are. */
  shown: PortChip[];
  /** What did not fit, collapsed to a "+N". */
  hidden: PortChip[];
  /** Tooltip for that "+N": one hidden port per line. */
  hiddenTitle: string;
}

/** Published port as it is read on a command line: "8080→80", or "auto→80" when
 *  the orchestrator picks it (0). TCP is the default and goes unmarked. */
export function portLabel(p: PortDTO): string {
  const published = p.published_port ? String(p.published_port) : 'auto';
  const proto = p.protocol === 'tcp' ? '' : `/${p.protocol}`;
  return `${published}→${p.target_port}${proto}`;
}

/** Everything the short label leaves out, including how the port is published. */
export function portTitle(p: PortDTO): string {
  const published = p.published_port
    ? `port publié ${p.published_port}`
    : 'port publié attribué automatiquement';
  const mode = p.mode === 'host' ? 'mode hôte' : 'routing mesh';
  return `${p.protocol.toUpperCase()} — ${published} → conteneur ${p.target_port} (${mode})`;
}

/**
 * Splits a service's ports into what a table cell can show and what it folds
 * away, so a service exposing a dozen ports does not push the row's other
 * columns off screen.
 */
export function summarizePorts(ports: PortDTO[] | undefined, max = 3): PortSummary {
  const chips = (ports ?? []).map((p) => ({ label: portLabel(p), title: portTitle(p) }));
  const hidden = chips.slice(max);
  return {
    shown: chips.slice(0, max),
    hidden,
    hiddenTitle: hidden.map((c) => `${c.label}  ${c.title}`).join('\n'),
  };
}
