// Focused tests for the Admin-only WhatsApp fee-reminder page.
//
// The selection/confirmation helpers are framework-free, so they run under the
// project's existing `node --test` setup. The static checks pin the two security
// properties that are easy to lose in a future refactor: the page is guarded by
// `RequireAdmin` and the sidebar link is only rendered for an Admin.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  MAX_WHATSAPP_REMINDER_RECIPIENTS,
  WHATSAPP_TABS,
  buildSendRequest,
  formatWhatsAppNumber,
  getEligibleRecipients,
  getRecipientListState,
  getReviewState,
  isWhatsAppConnected,
  selectAllEligible,
  summarizeWhatsAppMessage,
  toggleRecipientSelection,
} = await import('../src/utils/whatsappFeeReminders.js');

const { renderFeeReminderMessage } = await import('../src/utils/feeReminderTemplate.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');

const recipients = [
  {
    studentId: 'STD-0001',
    fullName: 'Ayesha Khan',
    className: 'Class 4',
    totalOutstanding: 12500,
    whatsappNumber: '923001234567',
    eligible: true,
    reason: 'ready',
    context: {
      studentName: 'Ayesha Khan',
      studentId: 'STD-0001',
      className: 'Class 4',
      outstanding: 12500,
      feePeriod: 'January',
      schoolName: 'Green Valley School',
    },
  },
  {
    studentId: 'STD-0002',
    fullName: 'Bilal Ahmed',
    className: 'Class 5',
    totalOutstanding: 5000,
    whatsappNumber: '923007654321',
    eligible: true,
    reason: 'ready',
    context: {
      studentName: 'Bilal Ahmed',
      studentId: 'STD-0002',
      className: 'Class 5',
      outstanding: 5000,
      feePeriod: 'January',
      schoolName: 'Green Valley School',
    },
  },
  {
    studentId: 'STD-0003',
    fullName: 'No Number',
    className: 'Class 6',
    totalOutstanding: 900,
    whatsappNumber: '',
    eligible: false,
    reason: 'missing_whatsapp',
    context: { studentName: 'No Number', studentId: 'STD-0003', outstanding: 900 },
  },
];

test('formats the stored canonical WhatsApp number for display', () => {
  assert.equal(formatWhatsAppNumber('923001234567'), '+92 300 1234567');
  assert.equal(formatWhatsAppNumber(''), 'Not provided');
  assert.equal(formatWhatsAppNumber(null), 'Not provided');
  assert.equal(formatWhatsAppNumber('923009999999'), '+92 300 9999999');
});

test('only eligible recipients can be selected and the batch limit is enforced', () => {
  const first = toggleRecipientSelection([], 'STD-0001', recipients, 100);
  assert.deepEqual(first.ids, ['STD-0001']);
  assert.equal(first.changed, true);

  const missing = toggleRecipientSelection([], 'STD-0003', recipients, 100);
  assert.deepEqual(missing.ids, []);
  assert.equal(missing.ineligible, true);
  assert.equal(missing.changed, false);

  const limited = toggleRecipientSelection(['STD-0001'], 'STD-0002', recipients, 1);
  assert.deepEqual(limited.ids, ['STD-0001']);
  assert.equal(limited.limited, true);

  const removed = toggleRecipientSelection(['STD-0001', 'STD-0002'], 'STD-0001', recipients);
  assert.deepEqual(removed.ids, ['STD-0002']);
  assert.equal(removed.changed, true);
});

test('select all eligible skips missing-number rows and reports truncation', () => {
  const all = selectAllEligible(recipients);
  assert.deepEqual(all.ids, ['STD-0001', 'STD-0002']);
  assert.equal(all.totalEligible, 2);
  assert.equal(all.truncated, false);
  assert.equal(getEligibleRecipients(recipients).length, 2);

  const truncated = selectAllEligible(recipients, 1);
  assert.deepEqual(truncated.ids, ['STD-0001']);
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.totalEligible, 2);
});

test('send payload contains only selected IDs, the year and the server-rendered template', () => {
  const request = buildSendRequest({
    studentIds: ['STD-0001', ' STD-0002 ', 'STD-0001', '', null, 42],
    academicYear: '2026',
    messageTemplate: '  Dear {{studentName}}, your balance is PKR {{outstanding}}.  ',
    // These are intentionally passed in and must never survive into the
    // request body: the server must recalculate/render from its own data.
    outstanding: 1,
    to: '920000000000',
    whatsappNumber: '920000000000',
  });

  assert.deepEqual(request, {
    studentIds: ['STD-0001', 'STD-0002'],
    academicYear: '2026',
    messageTemplate: 'Dear {{studentName}}, your balance is PKR {{outstanding}}.',
  });
  assert.equal(Object.hasOwn(request, 'outstanding'), false);
  assert.equal(Object.hasOwn(request, 'to'), false);
  assert.equal(Object.hasOwn(request, 'whatsappNumber'), false);

  const defaultTemplate = buildSendRequest({
    studentIds: ['STD-0001'],
    academicYear: '2026',
    messageTemplate: '   ',
  });
  assert.equal(defaultTemplate.templateId, 'default');
  assert.equal(Object.hasOwn(defaultTemplate, 'messageTemplate'), false);
});

test('list and review states cover loading, API error, empty and disconnected UI', () => {
  assert.equal(getRecipientListState({ loading: true, error: '', recipients: [] }), 'loading');
  assert.equal(getRecipientListState({ loading: false, error: 'HTTP 500', recipients }), 'error');
  assert.equal(getRecipientListState({ loading: false, error: '', recipients: [] }), 'empty');
  assert.equal(
    getRecipientListState({
      loading: false,
      error: '',
      recipients: [recipients[2]],
    }),
    'no-eligible',
  );
  assert.equal(getRecipientListState({ loading: false, error: '', recipients }), 'ready');

  assert.equal(isWhatsAppConnected({ status: 'connected' }), true);
  assert.equal(isWhatsAppConnected({ status: 'disconnected' }), false);
  assert.equal(isWhatsAppConnected({ status: 'unknown' }), false);
  assert.equal(isWhatsAppConnected(null), false);

  assert.equal(
    getReviewState({
      isConnected: false,
      selectedCount: 1,
      messageTemplate: 'Hello',
      sending: false,
    }).canReview,
    false,
  );
  assert.equal(
    getReviewState({
      isConnected: true,
      selectedCount: 0,
      messageTemplate: 'Hello',
      sending: false,
    }).canReview,
    false,
  );
  assert.equal(
    getReviewState({
      isConnected: true,
      selectedCount: 1,
      messageTemplate: '   ',
      sending: false,
    }).canReview,
    false,
  );
  assert.equal(
    getReviewState({
      isConnected: true,
      selectedCount: 1,
      messageTemplate: 'Hello',
      sending: true,
    }).canReview,
    false,
  );
  assert.equal(
    getReviewState({
      isConnected: true,
      selectedCount: 1,
      messageTemplate: 'Hello',
      sending: false,
    }).canReview,
    true,
  );
});

test('the review preview is rendered from the server-supplied recipient context', () => {
  const preview = renderFeeReminderMessage(
    'Dear {{studentName}}, your outstanding is PKR {{outstanding}} for {{feePeriod}}.',
    recipients[0].context,
  );
  assert.match(preview, /Ayesha Khan/);
  assert.match(preview, /12,500/);
  assert.match(preview, /January/);
});

test('the module exposes a Fee Reminders tab and an Assignments tab', () => {
  assert.deepEqual(
    WHATSAPP_TABS.map((tab) => tab.key),
    ['fee-reminders', 'assignments'],
  );
  assert.deepEqual(
    WHATSAPP_TABS.map((tab) => tab.label),
    ['Fee Reminders', 'Assignments'],
  );
});

test('summarizing a template replaces placeholders with readable labels', () => {
  const summarized = summarizeWhatsAppMessage(
    'Dear {{studentName}}, your balance of PKR {{outstanding}} for {{className}} is due.',
  );
  assert.match(summarized, /Dear Student name/);
  assert.match(summarized, /PKR Outstanding amount/);
  assert.match(summarized, /Class/);
  assert.doesNotMatch(summarized, /\{\{/);

  // An unknown token still resolves to something readable rather than a blank.
  assert.equal(summarizeWhatsAppMessage('{{customToken}}'), 'the school');
  assert.equal(summarizeWhatsAppMessage(''), '');
  assert.equal(summarizeWhatsAppMessage(null), '');
});

test('the /admin/whatsapp route is wrapped in RequireAdmin and the sidebar link is Admin-only', () => {
  const appSource = fs.readFileSync(path.join(FRONTEND_ROOT, 'src/App.jsx'), 'utf8');
  assert.match(
    appSource,
    /path="whatsapp"[\s\S]{0,260}<RequireAdmin>[\s\S]{0,220}<WhatsAppFeeRemindersPage\s*\/>/,
  );

  const sidebarSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/layout/Sidebar/Sidebar.jsx'),
    'utf8',
  );
  assert.match(
    sidebarSource,
    /\{role === 'admin' && \([\s\S]{0,700}`\$\{base\}\/whatsapp`/,
  );
  // Visible label renamed to "WhatsApp Reminder" while the route/API stay put.
  assert.match(sidebarSource, />WhatsApp Reminder</);
  assert.doesNotMatch(sidebarSource, /WhatsApp Fee Reminders/);
});

test('the page heading is renamed and both tabs are wired to real components', () => {
  const pageSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/whatsapp/FeeReminders/WhatsAppFeeReminders.jsx'),
    'utf8',
  );
  assert.match(pageSource, /WhatsApp Reminder/);
  assert.doesNotMatch(pageSource, /WhatsApp Fee Reminders/);
  // The container renders the fee-reminder workflow and the Assignments tab.
  assert.match(pageSource, /<FeeRemindersTab\s*\/>/);
  assert.match(pageSource, /<WhatsAppAssignments\s*\/>/);
  assert.match(pageSource, /WHATSAPP_TABS\.map/);
});

test('the Assignments tab implements the Homework Diary upload and send workflow', () => {
  const assignmentsSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/whatsapp/Assignments/WhatsAppAssignments.jsx'),
    'utf8',
  );
  assert.match(assignmentsSource, /HomeworkDiaryTab/);
  assert.doesNotMatch(assignmentsSource, /disabled/);

  const homeworkDiarySource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/whatsapp/Assignments/HomeworkDiaryTab.jsx'),
    'utf8',
  );
  assert.match(homeworkDiarySource, /createObjectURL/);
  assert.match(homeworkDiarySource, /revokeObjectURL/);

  // The component delegates image upload and sending to the existing service;
  // it never talks to the WhatsApp provider directly.
  assert.match(homeworkDiarySource, /whatsappHomeworkDiaryService\.uploadImage/);
  assert.match(homeworkDiarySource, /whatsappHomeworkDiaryService\.sendHomeworkDiary/);
  assert.doesNotMatch(homeworkDiarySource, /sendTextMessage|https:\/\/whatsapp\.|fetch\(/);
  assert.doesNotMatch(homeworkDiarySource, /WhatsApp image sending is not available yet/);

  // The recipient preview and the explicit confirmation step are both present.
  assert.match(homeworkDiarySource, /Eligible Recipients \(Preview\)/);
  assert.match(homeworkDiarySource, /Confirm WhatsApp Homework Diary/);
  assert.match(homeworkDiarySource, /Confirm and send to/);
  assert.match(homeworkDiarySource, /Sending may contact real guardians/);
  assert.match(homeworkDiarySource, /provider acceptance only/i);
  assert.match(homeworkDiarySource, /cannot be submitted\s+twice/);
});

test('the sidebar keeps its nav scroll container without a global scrollbar hide', () => {
  const sidebarSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/layout/Sidebar/Sidebar.jsx'),
    'utf8',
  );
  // Legitimate scrolling is preserved on the nav itself.
  assert.match(sidebarSource, /<nav className="flex-1 overflow-y-auto py-4">/);
  // The page must never globally hide scrollbars.
  assert.doesNotMatch(sidebarSource, /scrollbar-hide|::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
});

test('the page renders explicit loading, API-error, empty and confirmation states', () => {
  const pageSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/whatsapp/FeeReminders/WhatsAppFeeReminders.jsx'),
    'utf8',
  );
  assert.match(pageSource, /listState === 'loading'/);
  assert.match(pageSource, /listState === 'error'/);
  assert.match(pageSource, /listState === 'empty'/);
  assert.match(pageSource, /Review WhatsApp Reminders/);
  assert.match(pageSource, /Confirm and send to/);
  assert.match(pageSource, /Sending may contact a real guardian/);
  assert.match(pageSource, /cannot be submitted twice/);
  assert.match(pageSource, /provider acceptance only/i);
});

test('the admin shell and the WhatsApp tabs keep a single page scroll region', () => {
  const layoutSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/layouts/AdminLayout.jsx'),
    'utf8',
  );
  // The layout must use the dynamic viewport height so mobile browser chrome
  // cannot create a second (document) scrollbar or a gap below the content.
  assert.match(layoutSource, /h-dvh/);
  assert.doesNotMatch(layoutSource, /h-screen/);
  // Only the main content area scrolls; the shell and sidebar stay fixed.
  assert.match(layoutSource, /<main className="[^"]*overflow-y-auto[^"]*overscroll-contain/);
  assert.match(layoutSource, /overscroll-none/);

  const pageSource = fs.readFileSync(
    path.join(FRONTEND_ROOT, 'src/components/whatsapp/FeeReminders/WhatsAppFeeReminders.jsx'),
    'utf8',
  );
  // Switching tabs resets the one scroll container rather than keeping the
  // previous tab's offset.
  assert.match(pageSource, /main\.scrollTo\(\{ top: 0, left: 0/);
  // The review list must not introduce a second, nested vertical scrollbar.
  assert.doesNotMatch(pageSource, /max-h-96 overflow-y-auto/);
});

test('the recipient limit stays aligned with the backend', () => {
  assert.equal(MAX_WHATSAPP_REMINDER_RECIPIENTS, 100);
});
