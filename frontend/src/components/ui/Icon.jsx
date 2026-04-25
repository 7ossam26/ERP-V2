import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowLeftRight, ArrowRight,
  ArrowUpDown, Banknote, BarChart3, Bell, Bike, BookOpen,
  Calculator, Calendar, Check, CheckCircle, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, ClipboardCheck, ClipboardList,
  Clock, Code, Coffee, Construction, Copy, CreditCard, Download,
  Eye, EyeOff, ExternalLink, FileEdit, FileText, FileUp, Filter,
  Flag, Folders, Globe, HelpCircle, History, Hourglass, Home,
  IdCard, Info, LayoutDashboard, LayoutGrid, Lightbulb, LineChart,
  ListPlus, ListX, Loader, Lock, LockOpen, LogIn, LogOut, Landmark,
  Map, Menu, Minus, MinusCircle, Monitor, Moon, Package, PauseCircle,
  Pencil, PieChart, Plus, PlusCircle, Printer, QrCode, Receipt,
  RefreshCw, RotateCw, Ruler, Save, ScanLine, Scissors, Search,
  Send, Settings, ShieldAlert, ShoppingCart, SlidersHorizontal,
  Store, Sun, Table, Tag, Tags, Trash2, Truck, TrendingUp, Undo2,
  Upload, User, UserCog, Users, UserX, Wallet, Warehouse,
  X, XCircle, PiggyBank,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Material-icon-name → Lucide component lookup                      */
/* ------------------------------------------------------------------ */
const MAP = {
  access_time: Clock,
  account_balance: Landmark,
  account_balance_wallet: Wallet,
  add: Plus,
  add_circle: PlusCircle,
  add_circle_outline: PlusCircle,
  apps: LayoutGrid,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  assignment: ClipboardList,
  assignment_return: Undo2,
  autorenew: RefreshCw,
  badge: IdCard,
  bar_chart: BarChart3,
  calculate: Calculator,
  cancel: XCircle,
  category: Folders,
  check: Check,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  clear_all: ListX,
  close: X,
  code: Code,
  coffee_maker: Coffee,
  construction: Construction,
  content_copy: Copy,
  content_cut: Scissors,
  credit_card: CreditCard,
  dangerous: ShieldAlert,
  dashboard: LayoutDashboard,
  dashboard_customize: LayoutDashboard,
  delete: Trash2,
  delete_outline: Trash2,
  delete_sweep: Trash2,
  delivery_dining: Bike,
  done: Check,
  edit: Pencil,
  edit_note: FileEdit,
  error: AlertCircle,
  error_outline: AlertCircle,
  fact_check: ClipboardCheck,
  grid_view: LayoutGrid,
  group: Users,
  groups: Users,
  help: HelpCircle,
  help_outline: HelpCircle,
  history: History,
  history_edu: BookOpen,
  home: Home,
  info: Info,
  inventory: Package,
  inventory_2: Package,
  kitchen: ChefHat,
  language: Globe,
  leaderboard: TrendingUp,
  lightbulb: Lightbulb,
  local_cafe: Coffee,
  local_shipping: Truck,
  lock: Lock,
  lock_open: LockOpen,
  login: LogIn,
  logout: LogOut,
  manage_accounts: UserCog,
  map: Map,
  menu: Menu,
  menu_book: BookOpen,
  motorcycle: Bike,
  nights_stay: Moon,
  notifications: Bell,
  open_in_new: ExternalLink,
  pause_circle: PauseCircle,
  payments: Banknote,
  person: User,
  pie_chart: PieChart,
  playlist_add: ListPlus,
  point_of_sale: Monitor,
  print: Printer,
  progress_activity: Loader,
  qr_code_2: QrCode,
  qr_code_scanner: ScanLine,
  receipt: Receipt,
  receipt_long: FileText,
  refresh: RefreshCw,
  remove: Minus,
  remove_circle: MinusCircle,
  Remove_circle: MinusCircle,
  report: Flag,
  save: Save,
  savings: PiggyBank,
  schedule: Clock,
  search: Search,
  send: Send,
  settings: Settings,
  settings_applications: SlidersHorizontal,
  shopping_cart: ShoppingCart,
  show_chart: LineChart,
  store: Store,
  storefront: Store,
  straighten: Ruler,
  summarize: FileText,
  swap_horiz: ArrowLeftRight,
  swap_vert: ArrowUpDown,
  sync: RefreshCw,
  table_view: Table,
  tag: Tag,
  trending_up: TrendingUp,
  tune: SlidersHorizontal,
  upload: Upload,
  upload_file: FileUp,
  visibility: Eye,
  visibility_off: EyeOff,
  warehouse: Warehouse,
  warning: AlertTriangle,
  wb_sunny: Sun,
  hourglass_empty: Hourglass,
  download: Download,
  expand_more: ChevronDown,
  expand_less: ChevronUp,
  filter_list: Filter,
  filter_alt: Filter,
};

/* ------------------------------------------------------------------ */
/*  text-* class → pixel size mapping                                 */
/* ------------------------------------------------------------------ */
const SIZE = {
  "text-xs": 12,
  "text-sm": 14,
  "text-base": 16,
  "text-lg": 18,
  "text-xl": 20,
  "text-2xl": 24,
  "text-3xl": 30,
  "text-4xl": 36,
  "text-5xl": 48,
  "text-6xl": 60,
  "text-7xl": 72,
  "text-8xl": 96,
  "text-9xl": 128,
};

// Regex to match text-size and text-[Npx] classes
const SIZE_RE = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/;
const BRACKET_RE = /\btext-\[(\d+)px\]/;

/**
 * Universal icon component — drop-in replacement for material-icons-round
 * and material-symbols-outlined spans.
 *
 * Usage:
 *   <Icon name="home" className="text-xl text-accent" />
 *   <Icon name="close" size={20} className="text-muted" />
 */
export default function Icon({ name, className = "", size: sizeProp, strokeWidth = 2, ...rest }) {
  const Comp = MAP[name];

  if (!Comp) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] Unknown icon name: "${name}"`);
    }
    return null;
  }

  // Resolve size: explicit prop > text-[Npx] > text-size class > default 20
  let resolvedSize = sizeProp;
  let filteredClass = className;

  if (!resolvedSize) {
    const bracketMatch = className.match(BRACKET_RE);
    if (bracketMatch) {
      resolvedSize = parseInt(bracketMatch[1], 10);
      filteredClass = filteredClass.replace(BRACKET_RE, "").trim();
    } else {
      const sizeMatch = className.match(SIZE_RE);
      if (sizeMatch) {
        resolvedSize = SIZE[sizeMatch[0]] || 20;
        filteredClass = filteredClass.replace(SIZE_RE, "").trim();
      }
    }
  } else {
    // Still strip text-size classes from className so they don't leak to SVG
    filteredClass = filteredClass.replace(SIZE_RE, "").replace(BRACKET_RE, "").trim();
  }

  resolvedSize = resolvedSize || 20;

  // Clean up residual double spaces
  filteredClass = filteredClass.replace(/\s{2,}/g, " ").trim();

  return (
    <Comp
      size={resolvedSize}
      strokeWidth={strokeWidth}
      className={filteredClass || undefined}
      {...rest}
    />
  );
}

// Re-export MAP for command palette and programmatic usage
export { MAP as ICON_MAP };
