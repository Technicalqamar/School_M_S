import {
  HomeIcon,
  UsersIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

// These previews are hand-built, illustrative UI mockups of this application.
// They intentionally use real module names but no real (or invented) numbers,
// and they are clearly labelled as non-live previews in the caption.

const SkeletonBar = ({ className = '' }) => (
  <span className={`block h-2 rounded-full bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const WindowFrame = ({ path, children }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      <span className="mx-auto max-w-[70%] truncate rounded-md bg-white px-3 py-1 text-[10px] text-gray-500 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">
        {path}
      </span>
    </div>
    {children}
  </div>
);

const DASH_NAV = [
  { Icon: HomeIcon, label: 'Dashboard' },
  { Icon: UsersIcon, label: 'Students' },
  { Icon: AcademicCapIcon, label: 'Teachers' },
  { Icon: BookOpenIcon, label: 'Classes' },
  { Icon: ClipboardDocumentCheckIcon, label: 'Attendance' },
  { Icon: BanknotesIcon, label: 'Fees' },
  { Icon: DocumentTextIcon, label: 'Exams' },
  { Icon: Cog6ToothIcon, label: 'Settings' },
];

const STAT_TILES = [
  { Icon: UsersIcon, label: 'Students', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { Icon: AcademicCapIcon, label: 'Teachers', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  { Icon: BookOpenIcon, label: 'Classes', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  { Icon: BanknotesIcon, label: 'Fee Collected', color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
];

const BAR_HEIGHTS = [45, 65, 38, 80, 55, 72, 48, 90];

const TABLE_ROWS = [
  { status: 'Active', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { status: 'Active', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { status: 'Leave', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { status: 'Active', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

const MOBILE_ITEMS = [
  { Icon: BookOpenIcon, label: 'Homework', tone: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { Icon: ClipboardDocumentCheckIcon, label: 'Attendance', tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  { Icon: BanknotesIcon, label: 'Fees', tone: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
  { Icon: DocumentTextIcon, label: 'Examinations', tone: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  { Icon: MegaphoneIcon, label: 'Notices', tone: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' },
];

const DashboardPreview = () => (
  <WindowFrame path="school-management.app/admin">
    <div className="flex">
      <div className="hidden w-40 flex-shrink-0 flex-col gap-1 border-r border-gray-100 p-3 sm:flex dark:border-gray-800">
        {DASH_NAV.map(({ Icon, label }, index) => (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
              index === 0 ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 p-4">
        <div className="grid grid-cols-2 gap-3">
          {STAT_TILES.map(({ Icon, label, color }) => (
            <div key={label} className="min-w-0 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${color}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
              </div>
              <SkeletonBar className="mt-3 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <SkeletonBar className="w-24" />
          <div className="mt-4 flex h-24 items-end gap-2">
            {BAR_HEIGHTS.map((height, index) => (
              <span
                key={index}
                className={`w-full rounded-t ${index % 3 === 0 ? 'bg-blue-600' : 'bg-blue-200 dark:bg-blue-900/60'}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  </WindowFrame>
);

const TablePreview = () => (
  <WindowFrame path="school-management.app/admin/students">
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <SkeletonBar className="w-28" />
        <span className="rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white">Add</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-2 bg-gray-50 px-3 py-2 dark:bg-gray-950">
          {['Name', 'Class', 'Status'].map((heading) => (
            <span key={heading} className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {heading}
            </span>
          ))}
        </div>
        {TABLE_ROWS.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.4fr_1fr_0.8fr] items-center gap-2 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-6 w-6 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
              <SkeletonBar className="w-full max-w-[5rem]" />
            </div>
            <SkeletonBar className="w-10" />
            <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-semibold ${row.tone}`}>
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  </WindowFrame>
);

const MobilePreview = () => (
  <div className="mx-auto w-full max-w-[16rem]">
    <div className="rounded-[2rem] border border-gray-200 bg-white p-2 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
      <div className="overflow-hidden rounded-[1.6rem] bg-gray-50 dark:bg-gray-950">
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 px-4 pb-5 pt-4 text-white">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/40" />
          <p className="text-[10px] uppercase tracking-wide text-blue-200">Student portal</p>
          <p className="text-sm font-semibold">Welcome back</p>
        </div>
        <div className="space-y-2 p-3">
          {MOBILE_ITEMS.map(({ Icon, label, tone }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm dark:bg-gray-900"
            >
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="truncate text-[11px] font-medium text-gray-700 dark:text-gray-200">{label}</span>
              <SkeletonBar className="ml-auto w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const CAPTIONS = {
  dashboard: 'Illustrative UI preview of the admin workspace — not a live screenshot.',
  table: 'Illustrative UI preview of a records list — not a live screenshot.',
  mobile: 'Illustrative UI preview of the student portal — not a live screenshot.',
};

const ProductPreview = ({ variant = 'dashboard' }) => {
  let content = <DashboardPreview />;
  if (variant === 'table') content = <TablePreview />;
  if (variant === 'mobile') content = <MobilePreview />;

  return (
    <figure className="w-full">
      <div aria-hidden="true">{content}</div>
      <figcaption className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        {CAPTIONS[variant] || CAPTIONS.dashboard}
      </figcaption>
    </figure>
  );
};

export default ProductPreview;
