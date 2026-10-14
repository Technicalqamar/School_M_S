import { useState } from 'react';
import { ChevronDownIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
  RECEPTIONIST_PERMISSION_MODULES,
  RECEPTIONIST_CAPABILITY_MODULES,
  sanitizePermissions,
  isValidPermission,
  buildPageKey,
  buildActionKey,
  setModuleGranted,
  revokeModule,
  setPageGranted,
  revokePageGranted,
  setActionGranted,
  revokeActionGranted,
  isModuleGranted,
  isModuleGrantedPartially,
  isPageGrantedEffective,
  isPageGrantedPartially,
  isActionGrantedEffective,
} from '../../../constants/receptionistPermissions';

// Native checkbox that also renders the indeterminate (partially-granted) state
// for module and page rows. `indeterminate` is a DOM property, so it is applied
// through a ref callback on every render.
const TriStateCheckbox = ({ checked, indeterminate, disabled, onChange, label }) => (
  <input
    type="checkbox"
    aria-label={label}
    checked={checked}
    disabled={disabled}
    onChange={onChange}
    ref={(el) => {
      if (el) el.indeterminate = indeterminate && !checked;
    }}
    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
  />
);

// One operation under a page (or directly under a capability module). The box
// reflects the *effective* grant (explicit key, module key or implied by a
// retained page), so it visibly stays checked while a page implies the action.
const ActionRow = ({ moduleKey, action, permissions, onChange, disabled }) => {
  const explicit = permissions.includes(buildActionKey(moduleKey, action.key));
  const effective = isActionGrantedEffective(permissions, moduleKey, action.key);
  const impliedByPages = (action.impliedByPages || []).filter((ip) =>
    permissions.includes(buildPageKey(moduleKey, ip)),
  );

  return (
    <label
      className="flex items-center gap-2.5 cursor-pointer select-none py-0.5"
      title={action.label}
    >
      <TriStateCheckbox
        checked={effective}
        indeterminate={false}
        disabled={disabled}
        label={action.label}
        onChange={() => onChange(effective ? revokeActionGranted(permissions, moduleKey, action.key) : setActionGranted(permissions, moduleKey, action.key))}
      />
      <span className={`text-xs ${effective ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
        {action.label}
      </span>
      {!explicit && effective && impliedByPages.length > 0 && (
        <span className="text-[10px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded px-1.5 py-0.5">
          via {impliedByPages.join(', ')}
        </span>
      )}
    </label>
  );
};

// One page/tab. The box is checked when the page key (or the module key) is
// stored and indeterminate when only some of its actions are granted.
const PageRow = ({ moduleKey, page, permissions, onChange, disabled }) => {
  const [pageOpen, setPageOpen] = useState(false);
  const effective = isPageGrantedEffective(permissions, moduleKey, page.key);
  const partial = isPageGrantedPartially(permissions, moduleKey, page.key);
  const hasActions = (page.actions || []).length > 0;

  return (
    <div className="rounded-md px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <div className="flex items-center gap-2.5">
        <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none min-w-0">
          <TriStateCheckbox
            checked={effective}
            indeterminate={partial}
            disabled={disabled}
            label={page.label}
            onChange={() =>
              onChange(
                effective
                  ? revokePageGranted(permissions, moduleKey, page.key)
                  : setPageGranted(permissions, moduleKey, page.key),
              )
            }
          />
          <span className={`text-sm ${effective || partial ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
            {page.label}
          </span>
          {hasActions && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{page.actions.length} actions</span>
          )}
        </label>
        {hasActions && (
          <button
            type="button"
            onClick={() => setPageOpen((o) => !o)}
            className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            aria-label={`Toggle ${page.label} actions`}
          >
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${pageOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {pageOpen && (
        <div className="mt-1 ml-6 space-y-0.5 border-l border-gray-100 dark:border-gray-700 pl-3">
          {(page.actions || []).map((action) => (
            <ActionRow
              key={action.key}
              moduleKey={moduleKey}
              action={action}
              permissions={permissions}
              onChange={onChange}
              disabled={disabled || isModuleGranted(permissions, moduleKey)}
            />
          ))}
        </div>
      )}
      {hasActions && !pageOpen && (
        <p className="ml-6 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          {partial
            ? 'Some actions granted'
            : effective
              ? 'All actions available'
              : 'No access'}
        </p>
      )}
    </div>
  );
};

// One module row: whole-module checkbox (select / revoke) plus expandable pages
// (and actions for capability modules). When the module key is stored, children
// are read-only - the module grant already covers everything, so fine-tuning
// starts by revoking the module.
const ModuleRow = ({ module, permissions, onChange, disabled, isCapability }) => {
  const [open, setOpen] = useState(false);
  const moduleKey = module.key;
  const granted = isModuleGranted(permissions, moduleKey);
  const partial = isModuleGrantedPartially(permissions, moduleKey);
  const pages = module.pages || [];
  const actions = module.actions || [];
  const hasChildren = pages.length > 0 || actions.length > 0;

  const handleModuleToggle = () => {
    if (granted) {
      // Module off: the module key AND every page/action key are revoked.
      onChange(revokeModule(permissions, moduleKey));
    } else {
      // Module on: the module key replaces any granular keys of the module.
      onChange(setModuleGranted(permissions, moduleKey));
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        granted || partial
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/15'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none min-w-0">
          <TriStateCheckbox
            checked={granted}
            indeterminate={partial}
            disabled={disabled}
            label={module.label}
            onChange={handleModuleToggle}
          />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
            {module.label}
          </span>
          {granted && (
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 rounded px-1.5 py-0.5">
              Full access
            </span>
          )}
          {partial && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded px-1.5 py-0.5">
              Partial
            </span>
          )}
        </label>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          >
            {open ? 'Hide' : 'Details'}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 pl-6 space-y-1">
          {pages.length > 0 ? (
            pages.map((page) => (
              <PageRow
                key={page.key}
                moduleKey={moduleKey}
                page={page}
                permissions={permissions}
                onChange={onChange}
                disabled={disabled || granted}
              />
            ))
          ) : (
            <div className="space-y-1">
              {actions.map((action) => (
                <div key={action.key} className="pl-1">
                  <ActionRow
                    moduleKey={moduleKey}
                    action={action}
                    permissions={permissions}
                    onChange={onChange}
                    disabled={disabled || granted}
                  />
                </div>
              ))}
            </div>
          )}
          {granted && (
            <p className="pt-1 text-[11px] text-blue-600 dark:text-blue-400">
              The whole module is granted. Untick the module checkbox to fine-tune
              individual pages and actions.
            </p>
          )}
        </div>
      )}

      {!open && !granted && !partial && !isCapability && (
        <p className="mt-1 pl-6 text-[11px] text-gray-400 dark:text-gray-500">
          No access to this module.
        </p>
      )}
    </div>
  );
};

// Catalogue-driven granular permission editor for receptionist accounts.
//
// Every row is one real Admin module; within a module you can grant the whole
// module (one checkbox), one page/tab, or one action (View/Create/Edit/Delete or
// a module-specific operation). The "Notification Bell" section lists the
// capability actions for the receptionist header bell (independent of the
// Communication module). Admin-only modules are absent from the catalogue and
// can never be granted.
//
// `value` is the raw stored permission-array (as the backend validates it);
// every change is applied through the pure transition helpers above and
// sanitized before it reaches `onChange`, so invalid keys never persist.
// `busy` disables the whole editor (used while a save is in flight).
const PermissionEditor = ({ value = [], onChange, busy = false }) => {
  const permissions = sanitizePermissions(value);
  const invalidStored = Array.isArray(value)
    ? value.filter((key) => !isValidPermission(key)).length
    : 0;

  const commit = (next) => onChange(sanitizePermissions(next));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
        <ShieldCheckIcon className="h-4 w-4" />
        {permissions.length} grant{permissions.length === 1 ? '' : 's'} selected
        {busy && <span className="text-blue-600 dark:text-blue-400 animate-pulse">· saving…</span>}
      </div>

      {invalidStored > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          {invalidStored} stored permission{invalidStored === 1 ? '' : 's'} did not
          match the catalogue and will be dropped on save.
        </p>
      )}

      {RECEPTIONIST_PERMISSION_MODULES.map((module) => (
        <ModuleRow
          key={module.key}
          module={module}
          permissions={permissions}
          onChange={commit}
          disabled={busy}
          isCapability={false}
        />
      ))}

      {RECEPTIONIST_CAPABILITY_MODULES.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Notification Bell (separate from Communication)
          </h4>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
            Independent grants for the receptionist header bell: which categories
            it shows and whether items can be marked read. Hidden entirely when
            &quot;Show the notification bell&quot; is not granted.
          </p>
          {RECEPTIONIST_CAPABILITY_MODULES.map((module) => (
            <ModuleRow
              key={module.key}
              module={module}
              permissions={permissions}
              onChange={commit}
              disabled={busy}
              isCapability
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PermissionEditor;