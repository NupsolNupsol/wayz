/**
 * Everything a customer reads, in Arabic.
 *
 * Staff work in whichever language they set on screen, but a message that leaves the platform —
 * a code by WhatsApp, an invoice by email, a warning that time is nearly up — is read by a customer
 * in Riyadh, so it goes out in Arabic. Kept together in one file so the wording is consistent and
 * can be changed without hunting through services.
 */

import type { Role } from '../domain/types.js'

const NEWLINE = String.fromCharCode(10)

/** The English ROLE_LABELS are what staff see on screen; an invitation goes out in Arabic. */
export const ROLE_LABELS_AR: Record<Role, string> = {
  AGENT: 'موظف كاونتر',
  DELIVERY_AGENT: 'مندوب توصيل',
  SUPERVISOR: 'مشرف',
  CHIEF_CAPTAIN: 'قائد الفريق',
  MANAGER: 'مدير نشاط',
  PROJECT_MANAGER: 'مدير مشروع',
  HR: 'الموارد البشرية والمصروفات',
  ACCOUNTANT: 'محاسب',
  TENANT_ADMIN: 'الرئيس التنفيذي / مدير الحساب',
}

export const RTL = 'rtl'
export const HTML_LANG = 'ar'

/** Latin digits inside Arabic text stay Latin — a code is read back digit by digit. */
export const otpWhatsApp = (code: string, brand: string) =>
  [
    `${brand}: رمز التحقق الخاص بك هو ${code}`,
    'ينتهي خلال ٥ دقائق ويُستخدم مرة واحدة.',
    'اقرأه للموظف فقط — لا تشاركه مع أي شخص آخر.',
  ].join(NEWLINE)

export const otpEmailCopy = (code: string, brand: string, opts: { retrieval?: boolean; customerName?: string } = {}) => ({
  subject: `${code} هو رمز التحقق من ${brand}`,
  greeting: opts.customerName ? `مرحبًا ${opts.customerName}،` : 'مرحبًا،',
  reason: opts.retrieval ? 'لاستلام أغراضك من الكاونتر' : 'لتأكيد هويتك على حجزك',
  expiry: 'ينتهي هذا الرمز خلال ٥ دقائق ويُستخدم مرة واحدة.',
  warning: 'اقرأه للموظف فقط — لا تشاركه مع أي شخص آخر.',
  ignore: 'إذا لم تطلب هذا الرمز، تجاهل الرسالة ولن يحدث أي إجراء.',
  preheader: (b: string) => `رمز ${b} الخاص بك هو ${code} وينتهي خلال ٥ دقائق.`,
  codeLabel: 'رمز التحقق',
})

export const invitationCopy = (tenantName: string) => ({
  subject: `تفعيل حسابك في ${tenantName}`,
  greeting: (name: string) => `مرحبًا ${name}،`,
  opened: (by: string, role: string) => `${by} أنشأ لك حسابًا في ${tenantName} بصفة ${role}.`,
  choose: 'اختر كلمة المرور الخاصة بك لإكمال التفعيل:',
  button: 'اختيار كلمة المرور',
  expires: (hours: number) => `الرابط يعمل مرة واحدة وينتهي خلال ${hours} ساعة.`,
  privacy: 'لا أحد في الشركة يعرف كلمة مرورك ولا يمكنه رؤيتها.',
  ignore: 'إذا لم تكن تتوقع هذه الرسالة، تجاهلها — لا يمكن استخدام الحساب قبل تعيين كلمة مرور.',
  preheader: `اختر كلمة المرور لإكمال تفعيل حسابك في ${tenantName}.`,
})

export const invoiceWhatsApp = (opts: {
  brand: string
  invoiceRef: string
  total: number
  currency: string
  tracking: string
  invoiceUrl?: string
}) => {
  const lines = [
    `${opts.brand}: شكرًا لتعاملك معنا.`,
    `الفاتورة ${opts.invoiceRef} — ${opts.total.toFixed(2)} ${opts.currency}.`,
    '',
    'تابع حجزك:',
    opts.tracking,
  ]
  if (opts.invoiceUrl) lines.push('', 'فاتورتك:', opts.invoiceUrl)
  return lines.join(NEWLINE)
}

/**
 * Invoice line names, in Arabic. An order line keeps its English name for the staff screens and
 * carries one of these for the slip the customer walks away with.
 */
export const lineNameAr = {
  bags: (product: string, count: number) => `${product} (${count} ${count === 1 ? 'حقيبة' : 'حقائب'})`,
  tours: (product: string, count: number) => `${product} — ${count} ${count === 1 ? 'رحلة' : 'رحلات'}`,
  quantity: (product: string, count: number) => (count > 1 ? `${product} × ${count}` : product),
  deposit: 'تأمين مسترد',
  discount: (reason: string) => `خصم — ${reason}`,
  free: (reason: string) => `مجانًا — ${reason}`,
  overtime: (hours: number) => `وقت إضافي — ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`,
  wrongStation: 'إرجاع في محطة أخرى',
  delivery: 'توصيل',
} as const

export const invoiceEmailCopy = (brand: string, invoiceRef: string) => ({
  subject: `فاتورتك ${invoiceRef} من ${brand}`,
  greeting: 'مرحبًا،',
  body: 'فاتورتك مرفقة بهذه الرسالة.',
  thanks: `شكرًا لتعاملك مع ${brand}.`,
})

export const expiryWarningWhatsApp = (opts: {
  brand: string
  ref: string
  minutesLeft: number
  graceMin: number
  blockMin: number
  rate: number
  currency: string
  tracking: string
}) =>
  [
    `${opts.brand}: تنتهي مدة حفظ أغراضك (${opts.ref}) خلال ${opts.minutesLeft} دقيقة تقريبًا.`,
    `لديك مهلة ${opts.graceMin} دقيقة بعدها — استلم خلالها ولا تدفع أي مبلغ إضافي.`,
    opts.rate > 0
      ? `بعد المهلة تُحتسب فترة كاملة مدتها ${opts.blockMin} دقيقة (${opts.rate} ${opts.currency} للساعة) حتى لو تأخرت دقائق معدودة.`
      : `بعد المهلة تُحتسب فترة كاملة مدتها ${opts.blockMin} دقيقة حتى لو تأخرت دقائق معدودة.`,
    `تابع حجزك: ${opts.tracking}`,
  ].join(NEWLINE)
