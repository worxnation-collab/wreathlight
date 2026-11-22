const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const Lock = () => (<svg {...s}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const Check = () => (<svg {...s}><path d="M5 12l5 5L20 7" /></svg>);
export const Warn = () => (<svg {...s}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></svg>);
export const Cross = () => (<svg {...s}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const Spark = () => (<svg {...s}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></svg>);
export const Share = () => (<svg {...s}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>);
export const Globe = () => (<svg {...s}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
export const Flame = () => (<svg {...s}><path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" /></svg>);
