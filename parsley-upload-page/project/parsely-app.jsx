const { useState, useRef, useEffect, useMemo } = React;

// ---------- Tweak defaults ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "defaultMode": "auto",
  "templateCount": 3,
  "showModeDescriptions": true,
  "initialScreen": "idle",
  "accentHue": 245
}/*EDITMODE-END*/;

// ---------- Icons ----------
const Icon = ({ d, size = 16, stroke = 1.6, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const UploadIcon = (p) => <Icon {...p} d="M12 16V4M12 4l-4 4M12 4l4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />;
const DocIcon = (p) => <Icon {...p} d={<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>} />;
const QueueIcon = (p) => <Icon {...p} d={<><rect x="4" y="5" width="16" height="3" rx="1"/><rect x="4" y="10.5" width="16" height="3" rx="1"/><rect x="4" y="16" width="16" height="3" rx="1"/></>} />;
const TemplateIcon = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9 9v11"/></>} />;
const SettingsIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />;
const SparkleIcon = (p) => <Icon {...p} d={<><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5 10.1 7.6z"/><path d="M19 3v3M17.5 4.5h3"/></>} />;
const ListIcon = (p) => <Icon {...p} d={<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>} />;
const CircleSlashIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></>} />;
const ChevronDownIcon = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;
const SearchIcon = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>} />;
const CheckIcon = (p) => <Icon {...p} d="M5 12l5 5 9-11" />;
const XIcon = (p) => <Icon {...p} d="M6 6l12 12M6 18L18 6" />;
const InfoIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8.5v.01"/></>} />;
const PlusIcon = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const EditIcon = (p) => <Icon {...p} d={<><path d="M4 20h4L20 8l-4-4L4 16z"/></>} />;
const LockIcon = (p) => <Icon {...p} d={<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></>} />;

// ---------- Sample templates ----------
const ALL_TEMPLATES = [
  { id: 't1', name: 'ACME Corp — Invoice', vendor: 'ACME Corporation', fields: 12, usage: 148, color: '#4F6BED' },
  { id: 't2', name: 'Stripe Receipt', vendor: 'Stripe, Inc.', fields: 8, usage: 96, color: '#635BFF' },
  { id: 't3', name: 'FedEx — Shipping Manifest', vendor: 'FedEx', fields: 14, usage: 42, color: '#4D148C' },
  { id: 't4', name: 'Contoso Utility Bill', vendor: 'Contoso Energy', fields: 9, usage: 31, color: '#E67324' },
  { id: 't5', name: 'Globex Purchase Order', vendor: 'Globex Industries', fields: 17, usage: 28, color: '#2E8F5A' },
  { id: 't6', name: 'UPS Freight Bill', vendor: 'UPS Freight', fields: 11, usage: 22, color: '#8B6914' },
  { id: 't7', name: 'Initech — Packing List', vendor: 'Initech Ltd.', fields: 10, usage: 19, color: '#D64545' },
  { id: 't8', name: 'Umbrella Corp — W-9', vendor: 'Umbrella Corp', fields: 6, usage: 7, color: '#0E1726' },
];

// ---------- Logo ----------
const ParselyLogo = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="0.5" y="0.5" width="21" height="21" rx="5.5" fill="var(--accent)" />
    <path d="M7.2 6h4.3c2.1 0 3.6 1.4 3.6 3.3s-1.5 3.3-3.6 3.3H9.2V16H7.2V6zm2 4.9h2.1c1 0 1.7-.6 1.7-1.6s-.7-1.6-1.7-1.6H9.2v3.2z" fill="#fff"/>
  </svg>
);

// ---------- Sidebar ----------
function Sidebar({ templateCount, templates }) {
  const navItems = [
    { id: 'parse', label: 'Parse', icon: UploadIcon, count: 0, active: true },
    { id: 'docs', label: 'Documents', icon: DocIcon, count: null },
    { id: 'queue', label: 'Queue', icon: QueueIcon, count: 0 },
    { id: 'templates', label: 'Templates', icon: TemplateIcon, count: templateCount },
  ];
  return (
    <aside style={sbStyles.aside} data-screen-label="Sidebar">
      <nav style={{ padding: '10px 8px' }}>
        {navItems.map(item => {
          const I = item.icon;
          return (
            <div key={item.id} style={{
              ...sbStyles.navItem,
              ...(item.active ? sbStyles.navActive : null),
            }}>
              <I size={16} stroke={1.7} />
              <span style={{ flex: 1, fontWeight: item.active ? 600 : 500 }}>{item.label}</span>
              {item.count !== null && (
                <span style={sbStyles.count}>{item.count}</span>
              )}
            </div>
          );
        })}
      </nav>
      <div style={sbStyles.section}>
        <div style={sbStyles.sectionHead}>
          <span>TEMPLATES</span>
          <button style={sbStyles.iconBtn} aria-label="New template"><PlusIcon size={12} stroke={2} /></button>
        </div>
        {templates.length === 0 ? (
          <div style={sbStyles.emptyTpl}>
            No templates yet. Save one after<br/>reviewing a parse.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {templates.slice(0, 6).map(t => (
              <div key={t.id} style={sbStyles.tplRow} title={t.vendor}>
                <span style={{ ...sbStyles.tplDot, background: t.color }} />
                <span style={sbStyles.tplName}>{t.name}</span>
                <span style={sbStyles.tplUse}>{t.usage}</span>
              </div>
            ))}
            {templates.length > 6 && (
              <div style={sbStyles.tplMore}>+{templates.length - 6} more</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

const sbStyles = {
  aside: {
    width: 236,
    minWidth: 236,
    borderRight: '1px solid var(--line)',
    background: '#FBFBFC',
    display: 'flex',
    flexDirection: 'column',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 6,
    fontSize: 13.5,
    color: 'var(--ink-2)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  navActive: {
    background: 'var(--accent-soft)',
    color: 'var(--accent-ink)',
  },
  count: {
    fontSize: 11,
    color: 'var(--ink-4)',
    background: 'transparent',
    border: '1px solid var(--line)',
    borderRadius: 4,
    padding: '1px 6px',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 18,
    textAlign: 'center',
  },
  section: {
    marginTop: 8,
    borderTop: '1px solid var(--line)',
    padding: '14px 14px 10px',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: 0.8,
    color: 'var(--ink-3)',
    marginBottom: 10,
  },
  iconBtn: {
    width: 20, height: 20, display: 'grid', placeItems: 'center',
    border: '1px solid var(--line)', borderRadius: 4, color: 'var(--ink-3)',
    background: '#fff',
  },
  emptyTpl: {
    fontSize: 12,
    color: 'var(--ink-4)',
    lineHeight: 1.5,
  },
  tplRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 6px',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 12.5,
    color: 'var(--ink-2)',
  },
  tplDot: { width: 8, height: 8, borderRadius: 2, flexShrink: 0 },
  tplName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tplUse: { fontSize: 11, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' },
  tplMore: { fontSize: 11.5, color: 'var(--ink-4)', padding: '6px 6px 0' },
};

// ---------- Topbar ----------
function Topbar() {
  return (
    <header style={tbStyles.bar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ParselyLogo />
        <span style={tbStyles.brand}>Parsely</span>
        <span style={tbStyles.sep}>/</span>
        <span style={tbStyles.crumb}>Documents</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={tbStyles.iconBtn} aria-label="Settings"><SettingsIcon size={16} stroke={1.6} /></button>
        <div style={tbStyles.avatar}>JK</div>
      </div>
    </header>
  );
}

const tbStyles = {
  bar: {
    height: 48,
    padding: '0 16px',
    borderBottom: '1px solid var(--line)',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' },
  sep: { color: 'var(--ink-4)', fontWeight: 300 },
  crumb: { color: 'var(--ink-3)', fontSize: 13 },
  iconBtn: {
    width: 28, height: 28, display: 'grid', placeItems: 'center',
    borderRadius: 6, color: 'var(--ink-3)',
  },
  avatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--accent-soft)',
    color: 'var(--accent-ink)',
    display: 'grid', placeItems: 'center',
    fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
  },
};

// ---------- Mode picker segmented control ----------
const MODES = [
  {
    id: 'auto',
    label: 'Auto-match',
    Icon: SparkleIcon,
    title: 'Auto-match a template',
    desc: "We'll compare the document to your saved templates and pick the best fit.",
    descShort: "We'll pick a template for you if one matches.",
    requiresTemplates: true,
  },
  {
    id: 'pick',
    label: 'Pick template',
    Icon: ListIcon,
    title: 'Pick a template',
    desc: "Choose a saved template to apply. Fields extract exactly as mapped.",
    descShort: "Choose one of your saved templates.",
    requiresTemplates: true,
  },
  {
    id: 'none',
    label: 'No template',
    Icon: CircleSlashIcon,
    title: 'Parse without a template',
    desc: "Raw extraction — we'll pull text, tables, and key-value pairs from scratch.",
    descShort: "Raw extraction — no template applied.",
    requiresTemplates: false,
  },
];

function ModePicker({ mode, setMode, templates, showDescriptions }) {
  return (
    <div style={mpStyles.wrap}>
      <div style={mpStyles.label}>
        <span>Parsing mode</span>
        <span style={mpStyles.labelHint}>Change anytime before parse</span>
      </div>
      <div style={mpStyles.seg} role="radiogroup" aria-label="Parsing mode">
        {MODES.map(m => {
          const disabled = m.requiresTemplates && templates.length === 0;
          const active = mode === m.id;
          const I = m.Icon;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !disabled && setMode(m.id)}
              title={disabled ? 'No templates yet — save one after your first parse.' : m.title}
              style={{
                ...mpStyles.segBtn,
                ...(active ? mpStyles.segBtnActive : null),
                ...(disabled ? mpStyles.segBtnDisabled : null),
              }}
            >
              <I size={15} stroke={1.8} />
              <span>{m.label}</span>
              {disabled && <LockIcon size={12} stroke={1.8} />}
            </button>
          );
        })}
      </div>
      {showDescriptions && (
        <ModeDescription mode={mode} templates={templates} />
      )}
    </div>
  );
}

function ModeDescription({ mode, templates }) {
  const m = MODES.find(x => x.id === mode);
  return (
    <div style={mpStyles.desc}>
      <InfoIcon size={13} stroke={1.7} />
      <span>
        {m.desc}
        {mode === 'auto' && templates.length > 0 && (
          <> <span style={{ color: 'var(--ink-4)' }}>· {templates.length} template{templates.length === 1 ? '' : 's'} on file</span></>
        )}
      </span>
    </div>
  );
}

const mpStyles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: 0.3,
    color: 'var(--ink-2)',
    textTransform: 'uppercase',
  },
  labelHint: {
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: 0,
    textTransform: 'none',
    color: 'var(--ink-4)',
  },
  seg: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    background: '#F1F3F6',
    border: '1px solid var(--line)',
  },
  segBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink-2)',
    background: 'transparent',
    transition: 'background 120ms, color 120ms, box-shadow 120ms',
    whiteSpace: 'nowrap',
  },
  segBtnActive: {
    background: '#fff',
    color: 'var(--ink-1)',
    fontWeight: 600,
    boxShadow: '0 1px 2px rgba(14,23,38,0.08), 0 0 0 1px rgba(14,23,38,0.05)',
  },
  segBtnDisabled: {
    color: 'var(--ink-4)',
    cursor: 'not-allowed',
    opacity: 0.65,
  },
  desc: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '8px 10px',
    fontSize: 12.5,
    lineHeight: 1.5,
    color: 'var(--ink-3)',
    background: 'var(--accent-softer)',
    border: '1px solid #E3ECFB',
    borderRadius: 6,
  },
};

// ---------- Template Combobox ----------
function TemplateCombobox({ templates, value, onChange, onClear }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = templates.find(t => t.id === value);
  const filtered = templates.filter(t =>
    !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.vendor.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...tcStyles.trigger,
          ...(open ? tcStyles.triggerOpen : null),
          ...(selected ? tcStyles.triggerFilled : null),
        }}
      >
        {selected ? (
          <>
            <span style={{ ...tcStyles.dot, background: selected.color }} />
            <span style={tcStyles.triggerLabel}>{selected.name}</span>
            <span style={tcStyles.triggerMeta}>{selected.fields} fields</span>
          </>
        ) : (
          <>
            <ListIcon size={14} stroke={1.7} />
            <span style={{ ...tcStyles.triggerLabel, color: 'var(--ink-3)' }}>
              Choose a template…
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={tcStyles.clearBtn}
            aria-label="Clear template"
            title="Clear selection"
          >
            <XIcon size={12} stroke={2} />
          </button>
        )}
        <ChevronDownIcon size={14} stroke={1.8} />
      </button>
      {open && (
        <div style={tcStyles.menu}>
          <div style={tcStyles.search}>
            <SearchIcon size={14} stroke={1.7} />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search templates"
              style={tcStyles.searchInput}
            />
            <kbd style={tcStyles.kbd}>{templates.length}</kbd>
          </div>
          <div style={tcStyles.list}>
            {filtered.length === 0 && (
              <div style={tcStyles.noMatch}>No templates match "{q}"</div>
            )}
            {filtered.map(t => {
              const active = t.id === value;
              return (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); setQ(''); }}
                  style={{
                    ...tcStyles.item,
                    ...(active ? tcStyles.itemActive : null),
                  }}
                >
                  <span style={{ ...tcStyles.dot, background: t.color, width: 10, height: 10 }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={tcStyles.itemName}>{t.name}</span>
                    <span style={tcStyles.itemMeta}>
                      {t.vendor} · {t.fields} fields · used {t.usage}×
                    </span>
                  </div>
                  {active && <CheckIcon size={14} stroke={2} />}
                </button>
              );
            })}
          </div>
          <div style={tcStyles.footer}>
            <button style={tcStyles.footerBtn}>
              <PlusIcon size={12} stroke={2} /> New template
            </button>
            <span style={{ color: 'var(--ink-4)', fontSize: 11.5 }}>
              Templates are defined after review.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const tcStyles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 10px',
    background: '#fff',
    border: '1px solid var(--line-strong)',
    borderRadius: 6,
    fontSize: 13,
    color: 'var(--ink-1)',
    textAlign: 'left',
    transition: 'border-color 120ms, box-shadow 120ms',
  },
  triggerOpen: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 3px rgba(47,111,235,0.12)',
  },
  triggerFilled: {
    background: '#fff',
  },
  triggerLabel: { fontWeight: 500 },
  triggerMeta: {
    fontSize: 11.5,
    color: 'var(--ink-4)',
    background: '#F1F3F6',
    padding: '1px 6px',
    borderRadius: 3,
    fontVariantNumeric: 'tabular-nums',
  },
  clearBtn: {
    width: 18, height: 18, display: 'grid', placeItems: 'center',
    borderRadius: 4, color: 'var(--ink-3)',
  },
  dot: { width: 8, height: 8, borderRadius: 2, flexShrink: 0 },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 6px)', left: 0, right: 0,
    background: '#fff',
    border: '1px solid var(--line-strong)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-pop)',
    zIndex: 20,
    overflow: 'hidden',
  },
  search: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    color: 'var(--ink-3)',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none', fontSize: 13,
    background: 'transparent', color: 'var(--ink-1)',
  },
  kbd: {
    fontSize: 10.5, padding: '1px 6px', border: '1px solid var(--line)',
    borderRadius: 3, color: 'var(--ink-3)', background: '#F7F8FA',
    fontFamily: 'var(--font-mono)',
  },
  list: {
    maxHeight: 260,
    overflowY: 'auto',
    padding: 6,
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '8px 10px',
    borderRadius: 6, fontSize: 13, color: 'var(--ink-1)',
    textAlign: 'left',
  },
  itemActive: { background: 'var(--accent-soft)' },
  itemName: {
    fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  itemMeta: {
    fontSize: 11.5, color: 'var(--ink-4)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  noMatch: {
    padding: '18px 12px',
    fontSize: 12.5, color: 'var(--ink-4)',
    textAlign: 'center',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid var(--line)',
    background: '#FBFBFC',
  },
  footerBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--ink-2)', fontWeight: 500,
  },
};

// ---------- Main upload card ----------
function UploadCard({ mode, setMode, templates, pickedTemplate, setPickedTemplate, showDescriptions, stage, setStage, fileMeta, setFileMeta }) {
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    const f = files && files[0];
    if (!f) return;
    setFileMeta({
      name: f.name || 'invoice-april.pdf',
      size: f.size || 284_000,
      type: f.type || 'application/pdf',
    });
    setStage('file');
  };

  const onChooseFile = () => fileInputRef.current?.click();
  const onTrySample = () => {
    setFileMeta({ name: 'sample-invoice.pdf', size: 218_416, type: 'application/pdf', sample: true });
    setStage('file');
  };

  const clearFile = () => {
    setFileMeta(null);
    setStage('idle');
  };

  const canParse =
    stage === 'file' && (mode !== 'pick' || pickedTemplate);

  // Lock visible on large content: dropzone changes by stage
  return (
    <div style={ucStyles.card}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Mode picker — always visible */}
      <div style={{ padding: '20px 20px 0' }}>
        <ModePicker
          mode={mode}
          setMode={setMode}
          templates={templates}
          showDescriptions={showDescriptions}
        />
      </div>

      {/* Contextual mode-specific extra control */}
      {mode === 'pick' && (
        <div style={{ padding: '12px 20px 0' }}>
          <TemplateCombobox
            templates={templates}
            value={pickedTemplate}
            onChange={setPickedTemplate}
            onClear={() => setPickedTemplate(null)}
          />
          {!pickedTemplate && (
            <div style={ucStyles.hint}>
              <InfoIcon size={12} stroke={1.8} />
              Pick a template to enable parsing.
            </div>
          )}
        </div>
      )}

      {/* Dropzone / file-selected area */}
      <div style={{ padding: '16px 20px 20px' }}>
        {stage === 'idle' ? (
          <div
            ref={dropRef}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            style={{
              ...ucStyles.drop,
              ...(dragOver ? ucStyles.dropActive : null),
            }}
          >
            <div style={ucStyles.dropIconWrap}>
              <UploadIcon size={20} stroke={1.8} />
            </div>
            <div style={ucStyles.dropTitle}>Drop a document to parse</div>
            <div style={ucStyles.dropSub}>
              Or choose a file — up to 20&nbsp;MB.
              {mode === 'auto' && " We'll auto-match to a template if we recognize it."}
              {mode === 'pick' && " Parses using the template you've selected above."}
              {mode === 'none' && " Parses as raw text — no template applied."}
            </div>
            <div style={ucStyles.dropActions}>
              <button style={ucStyles.primaryBtn} onClick={onChooseFile}>
                <UploadIcon size={14} stroke={1.9} /> Choose file
              </button>
              <button style={ucStyles.secondaryBtn} onClick={onTrySample}>
                <SparkleIcon size={14} stroke={1.8} /> Try sample invoice
              </button>
            </div>
            <div style={ucStyles.formats}>
              <span>PDF</span><span style={ucStyles.dot}>·</span>
              <span>PNG</span><span style={ucStyles.dot}>·</span>
              <span>JPG</span><span style={ucStyles.dot}>·</span>
              <span>TIFF</span>
            </div>
          </div>
        ) : (
          <FileSelected
            fileMeta={fileMeta}
            mode={mode}
            pickedTemplate={pickedTemplate}
            templates={templates}
            onChange={onChooseFile}
            onClear={clearFile}
            onParse={() => canParse && alert('Parse started (demo)')}
            canParse={canParse}
          />
        )}
      </div>
    </div>
  );
}

function FileSelected({ fileMeta, mode, pickedTemplate, templates, onChange, onClear, onParse, canParse }) {
  const t = templates.find(x => x.id === pickedTemplate);
  const formatSize = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024*1024) return `${(b/1024).toFixed(0)} KB`;
    return `${(b/(1024*1024)).toFixed(1)} MB`;
  };
  let modeSummary;
  if (mode === 'auto') {
    modeSummary = (
      <><SparkleIcon size={12} stroke={1.8} /> Auto-match enabled</>
    );
  } else if (mode === 'pick') {
    modeSummary = t ? (
      <>
        <span style={{ ...tcStyles.dot, background: t.color }} />
        Using <strong style={{ color: 'var(--ink-1)' }}>{t.name}</strong>
      </>
    ) : (
      <><InfoIcon size={12} stroke={1.8} /> Pick a template above</>
    );
  } else {
    modeSummary = (
      <><CircleSlashIcon size={12} stroke={1.8} /> Raw parse — no template</>
    );
  }
  return (
    <div style={fsStyles.wrap}>
      <div style={fsStyles.row}>
        <div style={fsStyles.fileIcon}>
          <DocIcon size={18} stroke={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={fsStyles.fileName}>
            {fileMeta.name}
            {fileMeta.sample && <span style={fsStyles.sampleTag}>sample</span>}
          </div>
          <div style={fsStyles.fileMeta}>
            {formatSize(fileMeta.size)} · {fileMeta.type.split('/')[1]?.toUpperCase() || 'PDF'} · ready to parse
          </div>
        </div>
        <button style={fsStyles.linkBtn} onClick={onChange}>Replace</button>
        <button style={fsStyles.iconClose} onClick={onClear} aria-label="Remove file">
          <XIcon size={14} stroke={1.9} />
        </button>
      </div>
      <div style={fsStyles.divider} />
      <div style={fsStyles.summary}>
        <span style={fsStyles.summaryLeft}>{modeSummary}</span>
        <button
          style={{ ...fsStyles.parseBtn, ...(canParse ? null : fsStyles.parseBtnDisabled) }}
          onClick={onParse}
          disabled={!canParse}
        >
          Parse document →
        </button>
      </div>
    </div>
  );
}

const ucStyles = {
  card: {
    width: 560,
    background: '#fff',
    border: '1px solid var(--line)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-card)',
  },
  hint: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginTop: 8, fontSize: 12, color: 'var(--warn)',
  },
  drop: {
    border: '1.5px dashed var(--line-strong)',
    borderRadius: 10,
    padding: '28px 20px 22px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: 6,
    background: '#FBFBFC',
    transition: 'background 120ms, border-color 120ms',
  },
  dropActive: {
    background: 'var(--accent-softer)',
    borderColor: 'var(--accent)',
  },
  dropIconWrap: {
    width: 44, height: 44, borderRadius: 10,
    background: 'var(--accent-soft)',
    color: 'var(--accent-ink)',
    display: 'grid', placeItems: 'center',
    marginBottom: 6,
  },
  dropTitle: {
    fontSize: 16, fontWeight: 600, color: 'var(--ink-1)',
  },
  dropSub: {
    fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55, maxWidth: 400,
  },
  dropActions: {
    display: 'flex', gap: 8, marginTop: 10,
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    background: 'var(--accent)', color: '#fff',
    borderRadius: 6, fontSize: 13, fontWeight: 500,
    boxShadow: '0 1px 0 rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    background: '#fff', color: 'var(--ink-2)',
    border: '1px solid var(--line-strong)',
    borderRadius: 6, fontSize: 13, fontWeight: 500,
  },
  formats: {
    marginTop: 10,
    display: 'flex', gap: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--ink-4)',
    letterSpacing: 0.5,
  },
  dot: { color: 'var(--ink-4)', opacity: 0.5 },
};

const fsStyles = {
  wrap: {
    border: '1px solid var(--line)',
    borderRadius: 10,
    background: '#FBFBFC',
    padding: 14,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  fileIcon: {
    width: 38, height: 44, borderRadius: 6,
    background: '#fff',
    border: '1px solid var(--line)',
    display: 'grid', placeItems: 'center',
    color: 'var(--ink-3)',
    position: 'relative',
  },
  fileName: {
    fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  sampleTag: {
    fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
    color: 'var(--accent-ink)', background: 'var(--accent-soft)',
    padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase',
  },
  fileMeta: {
    fontSize: 12, color: 'var(--ink-3)',
  },
  linkBtn: {
    fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500,
    padding: '5px 10px', border: '1px solid var(--line-strong)',
    borderRadius: 5, background: '#fff',
  },
  iconClose: {
    width: 26, height: 26, display: 'grid', placeItems: 'center',
    borderRadius: 5, color: 'var(--ink-3)',
  },
  divider: { height: 1, background: 'var(--line)' },
  summary: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  summaryLeft: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12.5, color: 'var(--ink-3)',
  },
  parseBtn: {
    padding: '8px 14px',
    background: 'var(--accent)', color: '#fff',
    borderRadius: 6, fontSize: 13, fontWeight: 600,
    boxShadow: '0 1px 0 rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  parseBtnDisabled: {
    background: '#C2CEE0', color: '#fff', cursor: 'not-allowed', boxShadow: 'none',
  },
};

// ---------- State demo strip (shows stage chips) ----------
function StageStrip({ mode, templates, pickedTemplate, stage }) {
  const t = templates.find(x => x.id === pickedTemplate);
  let stageLabel = 'Idle';
  if (stage === 'file') stageLabel = 'File selected';
  const modeLabel = MODES.find(m => m.id === mode)?.label;
  return (
    <div style={ssStyles.wrap}>
      <span style={ssStyles.chip}>
        <span style={ssStyles.chipDot} />
        {stageLabel}
      </span>
      <span style={ssStyles.arrow}>→</span>
      <span style={ssStyles.chip}>{modeLabel}</span>
      {mode === 'pick' && (
        <>
          <span style={ssStyles.arrow}>→</span>
          <span style={{ ...ssStyles.chip, ...(t ? ssStyles.chipActive : ssStyles.chipMissing) }}>
            {t ? t.name : 'No template chosen'}
          </span>
        </>
      )}
    </div>
  );
}

const ssStyles = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 14,
    fontSize: 11.5,
    fontFamily: 'var(--font-mono)',
    color: 'var(--ink-4)',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 8px',
    border: '1px solid var(--line)',
    borderRadius: 3,
    background: '#fff',
    color: 'var(--ink-3)',
    letterSpacing: 0.3,
  },
  chipActive: {
    color: 'var(--accent-ink)', borderColor: '#CFDEF9', background: 'var(--accent-soft)',
  },
  chipMissing: {
    color: 'var(--warn)', borderColor: '#EBD7A6', background: '#FBF5E4',
  },
  chipDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--success)',
    boxShadow: '0 0 0 2px rgba(46,143,90,0.15)',
  },
  arrow: { color: 'var(--ink-4)' },
};

// ---------- App ----------
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const templates = useMemo(() => ALL_TEMPLATES.slice(0, t.templateCount), [t.templateCount]);

  const [mode, setMode] = useState(t.defaultMode);
  const [pickedTemplate, setPickedTemplate] = useState(null);
  const [stage, setStage] = useState(t.initialScreen);
  const [fileMeta, setFileMeta] = useState(
    t.initialScreen === 'file'
      ? { name: 'invoice-april.pdf', size: 284_160, type: 'application/pdf' }
      : null
  );

  // Keep mode in sync if tweak default changes externally
  useEffect(() => {
    setMode(t.defaultMode);
  }, [t.defaultMode]);

  useEffect(() => {
    setStage(t.initialScreen);
    if (t.initialScreen === 'file' && !fileMeta) {
      setFileMeta({ name: 'invoice-april.pdf', size: 284_160, type: 'application/pdf' });
    }
    if (t.initialScreen === 'idle') {
      setFileMeta(null);
    }
  }, [t.initialScreen]);

  // If templates disappear and current mode requires them, drop to 'none'
  useEffect(() => {
    if (templates.length === 0 && (mode === 'auto' || mode === 'pick')) {
      setMode('none');
    }
  }, [templates.length]);

  // If mode changes away from 'pick', clear any selected template
  useEffect(() => {
    if (mode !== 'pick') setPickedTemplate(null);
  }, [mode]);

  // Apply accent hue
  useEffect(() => {
    const hue = t.accentHue;
    document.documentElement.style.setProperty('--accent', `oklch(0.58 0.16 ${hue})`);
    document.documentElement.style.setProperty('--accent-ink', `oklch(0.48 0.16 ${hue})`);
    document.documentElement.style.setProperty('--accent-soft', `oklch(0.96 0.04 ${hue})`);
    document.documentElement.style.setProperty('--accent-softer', `oklch(0.985 0.015 ${hue})`);
  }, [t.accentHue]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Topbar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar templateCount={templates.length} templates={templates} />
        <main style={mainStyles.main} data-screen-label="Parse main">
          <div style={mainStyles.inner}>
            <StageStrip mode={mode} templates={templates} pickedTemplate={pickedTemplate} stage={stage} />
            <UploadCard
              mode={mode}
              setMode={setMode}
              templates={templates}
              pickedTemplate={pickedTemplate}
              setPickedTemplate={setPickedTemplate}
              showDescriptions={t.showModeDescriptions}
              stage={stage}
              setStage={setStage}
              fileMeta={fileMeta}
              setFileMeta={setFileMeta}
            />
            <div style={mainStyles.footer}>
              Tip: change parsing mode any time before you click Parse.
            </div>
          </div>
        </main>
      </div>

      <TweaksPanel>
        <TweakSection label="Mode">
          <TweakRadio
            label="Default mode"
            value={t.defaultMode}
            onChange={v => setTweak('defaultMode', v)}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'pick', label: 'Pick' },
              { value: 'none', label: 'None' },
            ]}
          />
          <TweakToggle
            label="Show mode descriptions"
            value={t.showModeDescriptions}
            onChange={v => setTweak('showModeDescriptions', v)}
          />
        </TweakSection>
        <TweakSection label="Library">
          <TweakSelect
            label="Templates on file"
            value={t.templateCount}
            onChange={v => setTweak('templateCount', Number(v))}
            options={[
              { value: 0, label: '0 (empty state)' },
              { value: 3, label: '3 templates' },
              { value: 5, label: '5 templates' },
              { value: 8, label: '8 templates' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Demo state">
          <TweakRadio
            label="Upload stage"
            value={t.initialScreen}
            onChange={v => setTweak('initialScreen', v)}
            options={[
              { value: 'idle', label: 'Idle' },
              { value: 'file', label: 'File selected' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Brand">
          <TweakSlider
            label="Accent hue"
            value={t.accentHue}
            onChange={v => setTweak('accentHue', v)}
            min={0} max={360} step={1}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const mainStyles = {
  main: {
    flex: 1,
    background: 'var(--bg)',
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '60px 40px 60px',
  },
  inner: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: '100%', maxWidth: 560,
  },
  footer: {
    marginTop: 14,
    fontSize: 11.5,
    color: 'var(--ink-4)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: 0.3,
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
