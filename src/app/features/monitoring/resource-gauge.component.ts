import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** A Grafana-style 270° radial gauge for a 0..100 percentage. The arc fills from
 *  the bottom-left clockwise, coloured by threshold (green / amber / red); the
 *  value sits in the centre with a capacity caption below. Pure presentational —
 *  the parent computes the percentage. */
@Component({
  selector: 'hm-resource-gauge',
  imports: [DecimalPipe],
  template: `
    <div class="gauge">
      <svg
        viewBox="0 0 120 120"
        role="img"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [attr.aria-label]="label() + ' ' + (value() | number: '1.0-0') + ' %'"
      >
        <circle
          class="track"
          cx="60"
          cy="60"
          [attr.r]="radius"
          [attr.stroke-dasharray]="trackDash"
          transform="rotate(135 60 60)"
        />
        <circle
          class="value"
          cx="60"
          cy="60"
          [attr.r]="radius"
          [attr.stroke]="color()"
          [attr.stroke-dasharray]="valueDash()"
          transform="rotate(135 60 60)"
        />
        <!-- prettier-ignore -->
        <text x="60" y="60" class="g-val" [attr.fill]="color()">{{ value() | number: '1.0-0' }}<tspan class="g-pct">%</tspan></text>
        <text x="60" y="82" class="g-label">{{ label() }}</text>
      </svg>
      <div class="g-detail">{{ detail() }}</div>
    </div>
  `,
  styles: [
    `
      .gauge {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
      }
      svg {
        max-width: 100%;
      }
      .track {
        fill: none;
        stroke: rgba(128, 128, 128, 0.18);
        stroke-width: 11;
        stroke-linecap: round;
      }
      .value {
        fill: none;
        stroke-width: 11;
        stroke-linecap: round;
        transition:
          stroke-dasharray 0.5s ease,
          stroke 0.3s ease;
      }
      .g-val {
        font-size: 25px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: middle;
      }
      .g-pct {
        font-size: 13px;
        font-weight: 600;
      }
      .g-label {
        font-size: 12px;
        text-anchor: middle;
        fill: currentColor;
        opacity: 0.55;
        letter-spacing: 0.05em;
      }
      .g-detail {
        font-size: 0.8rem;
        opacity: 0.65;
        text-align: center;
      }
    `,
  ],
})
export class ResourceGauge {
  readonly value = input<number>(0);
  readonly label = input<string>('');
  readonly detail = input<string>('');
  /** Rendered SVG size in px (the cluster overview uses larger gauges). */
  readonly size = input<number>(120);

  readonly radius = 48;
  private readonly circ = 2 * Math.PI * this.radius;
  private readonly arc = 0.75 * this.circ; // 270° of visible sweep (90° gap at the bottom)
  readonly trackDash = `${this.arc} ${this.circ - this.arc}`;

  readonly valueDash = computed(() => {
    const pct = Math.max(0, Math.min(100, this.value())) / 100;
    return `${pct * this.arc} ${this.circ}`;
  });

  /** Threshold colour, matching Grafana's default gauge palette. */
  readonly color = computed(() => {
    const v = this.value();
    if (v >= 85) return '#ef4444';
    if (v >= 70) return '#f59e0b';
    return '#22c55e';
  });
}
