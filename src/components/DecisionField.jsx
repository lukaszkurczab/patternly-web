const captions = {
  neutral: "Map the decision",
  focused: "Inspect the constraint",
  resolved: "Useful path resolved",
};

export function DecisionField({ state = "neutral" }) {
  return (
    <div className="decision-instrument" data-state={state} aria-hidden="true">
      <svg className="decision-field-svg" viewBox="0 0 720 650" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="decision-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path className="decision-grid-line" d="M 32 0 L 0 0 0 32" />
          </pattern>
          <linearGradient id="decision-mint-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5eead4" stopOpacity=".28" />
            <stop offset=".54" stopColor="#5eead4" />
            <stop offset="1" stopColor="#a7f3e7" stopOpacity=".72" />
          </linearGradient>
        </defs>

        <rect className="decision-grid" width="720" height="650" fill="url(#decision-grid)" />
        <path className="decision-route decision-route-quiet" d="M88 92 C142 174 74 244 118 318 S250 430 510 578" pathLength="1" />
        <path className="decision-route decision-route-quiet" d="M150 90 C266 148 252 248 372 296 S534 374 586 574" pathLength="1" />
        <path className="decision-route decision-route-inspect" d="M150 90 C214 92 246 72 298 64 S420 72 496 106 C544 128 566 176 568 224" pathLength="1" />
        <path className="decision-route decision-route-resolved" d="M150 90 C214 92 246 72 298 64 S420 72 496 106 C598 152 654 242 630 358 S566 474 566 574" pathLength="1" />

        <rect className="decision-boundary" x="62" y="126" width="596" height="388" rx="20" />
        <path className="decision-boundary-corner" d="M62 174 V146 Q62 126 82 126 H110 M610 514 H638 Q658 514 658 494 V466" />

        <g className="decision-module decision-module-input" transform="translate(34 66)">
          <rect width="124" height="48" rx="10" />
          <path d="M18 17h12M18 24h20M18 31h15" />
          <text x="49" y="29">DECISION</text>
        </g>
        <g className="decision-module decision-module-constraint" transform="translate(292 40)">
          <rect width="142" height="48" rx="10" />
          <path d="M18 16v17M27 16v17M18 24h9" />
          <text x="46" y="29">CONSTRAINT</text>
        </g>
        <g className="decision-module decision-module-mechanism" transform="translate(520 82)">
          <rect width="164" height="48" rx="10" />
          <path d="M17 18l8 6-8 6M31 30h9" />
          <text x="52" y="29">MECHANISM</text>
        </g>
        <g className="decision-module decision-module-action" transform="translate(492 550)">
          <rect width="192" height="48" rx="10" />
          <path d="M18 24h18M29 17l7 7-7 7" />
          <text x="52" y="29">NEXT ACTION</text>
        </g>

        <rect className="decision-marker decision-marker-a" x="104" y="309" width="10" height="10" rx="2" />
        <rect className="decision-marker decision-marker-b" x="363" y="291" width="10" height="10" rx="2" />
        <rect className="decision-marker decision-marker-c" x="625" y="353" width="10" height="10" rx="2" />
      </svg>
      <span className="decision-instrument-caption">{captions[state]}</span>
    </div>
  );
}
