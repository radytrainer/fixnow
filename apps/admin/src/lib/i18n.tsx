"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "km";
const KEY = "fixnow.admin.lang";

/**
 * Admin translations, keyed by the English UI string. Shared components (PageHeader, Card, Button,
 * Filters, Table, KV, Stat, StatusBadge) run their string props through `tr`, so pages stay readable.
 * Machine-assisted Khmer — review with a native speaker before launch.
 */
const KM: Record<string, string> = {
  // shell & navigation
  "Overview": "ទិដ្ឋភាពទូទៅ", "Operations": "ប្រតិបត្តិការ", "Money": "ហិរញ្ញវត្ថុ", "Care": "សេវាអតិថិជន", "Insights": "ការវិភាគ",
  "Dashboard": "ផ្ទាំងគ្រប់គ្រង", "Technician approvals": "ការអនុម័តជាង", "Customers": "អតិថិជន", "Bookings": "ការកក់",
  "Timeouts & cancellations": "ផុតកំណត់ និងការលុបចោល", "Services & pricing": "សេវាកម្ម និងតម្លៃ", "Payments": "ការទូទាត់",
  "Technician payouts": "ការទូទាត់ឱ្យជាង", "Commission & settings": "កម្រៃជើងសារ និងការកំណត់", "Support & disputes": "ការគាំទ្រ និងវិវាទ",
  "Warranty": "ការធានា", "Reports & CSV": "របាយការណ៍ និង CSV", "Audit log": "កំណត់ហេតុសវនកម្ម", "Admin console": "ផ្ទាំងអ្នកគ្រប់គ្រង",
  "Administrator": "អ្នកគ្រប់គ្រង", "Sign out": "ចាកចេញ", "Sign in": "ចូល", "DEMO MODE · simulated payments": "របៀបសាកល្បង · ការទូទាត់ក្លែងធ្វើ",
  "Admin phone": "ទូរស័ព្ទអ្នកគ្រប់គ្រង", "Password": "ពាក្យសម្ងាត់", "Admin console · staff only": "ផ្ទាំងអ្នកគ្រប់គ្រង · សម្រាប់បុគ្គលិកប៉ុណ្ណោះ",
  // page headers
  "Business overview": "ទិដ្ឋភាពអាជីវកម្ម", "Technicians": "ជាង", "Reports": "របាយការណ៍",
  "Sen Sok pilot · Phnom Penh Thmei & Tuek Thla · live, refreshes every 5s": "គម្រោងសាកល្បងសែនសុខ · ភ្នំពេញថ្មី និងទឹកថ្លា · ធ្វើឱ្យថ្មីរៀងរាល់ ៥ វិនាទី",
  "Verify identity and certificates before a technician can receive jobs.": "ផ្ទៀងផ្ទាត់អត្តសញ្ញាណ និងវិញ្ញាបនបត្រ មុនពេលជាងអាចទទួលការងារ។",
  "Every booking across customers and technicians, live.": "ការកក់ទាំងអស់របស់អតិថិជន និងជាង (បច្ចុប្បន្នភាព)។",
  "Phone numbers are masked. Revealing one is recorded in the audit log.": "លេខទូរស័ព្ទត្រូវបានលាក់។ ការបង្ហាញលេខត្រូវបានកត់ត្រាក្នុងកំណត់ហេតុសវនកម្ម។",
  // stats & cards
  "Gross paid": "ចំណូលសរុបបានបង់", "FixNow commission": "កម្រៃជើងសារ FixNow", "Technician net": "ចំណូលសុទ្ធរបស់ជាង",
  "Awaiting payment": "រង់ចាំការទូទាត់", "Approved technicians": "ជាងដែលបានអនុម័ត", "Accept rate": "អត្រាទទួលយក",
  "Bookings per day": "ការកក់ប្រចាំថ្ងៃ", "Gross paid per day (USD)": "ចំណូលបានបង់ប្រចាំថ្ងៃ (ដុល្លារ)", "Bookings by status": "ការកក់តាមស្ថានភាព",
  "Live requests (5-minute window)": "សំណើកំពុងរង់ចាំ (៥ នាទី)", "Revenue before gateway fees": "ចំណូលមុនកាត់ថ្លៃសេវាធនាគារ",
  "Owed / paid to providers": "ជំពាក់ / បានបង់ឱ្យជាង", "Commission": "កម្រៃជើងសារ", "Provider net": "ចំណូលសុទ្ធអ្នកផ្តល់សេវា", "Users": "អ្នកប្រើប្រាស់",
  "Commission rate": "អត្រាកម្រៃជើងសារ", "Commission calculator": "ម៉ាស៊ីនគណនាកម្រៃជើងសារ", "Application settings": "ការកំណត់កម្មវិធី",
  "Technicians by status": "ជាងតាមស្ថានភាព", "Payouts by status": "ការទូទាត់ឱ្យជាងតាមស្ថានភាព",
  "Responded requests": "សំណើដែលបានឆ្លើយតប", "Accepted": "បានទទួលយក", "Expired (no response)": "ផុតកំណត់ (គ្មានការឆ្លើយតប)", "Declined": "បានបដិសេធ",
  "Waiting for technician": "រង់ចាំជាង", "Expired & declined": "ផុតកំណត់ និងបដិសេធ", "Cancelled & customer not available": "លុបចោល និងអតិថិជនមិននៅ",
  "Owed (pending + processing)": "ជំពាក់ (រង់ចាំ + កំពុងដំណើរការ)", "Paid out": "បានទូទាត់ហើយ", "Failed / cancelled": "បរាជ័យ / លុបចោល",
  "Payment": "ការទូទាត់", "Timeline & audit trail": "ពេលវេលា និងកំណត់ហេតុសវនកម្ម", "Admin actions": "សកម្មភាពអ្នកគ្រប់គ្រង", "Location": "ទីតាំង",
  "Verification decision": "ការសម្រេចផ្ទៀងផ្ទាត់", "Technician verification": "ការផ្ទៀងផ្ទាត់ជាង", "Booking": "ការកក់", "New service": "សេវាកម្មថ្មី",
  // table headers & KV
  "Technician": "ជាង", "Customer": "អតិថិជន", "Status": "ស្ថានភាព", "Area": "តំបន់", "Services": "សេវាកម្ម", "Service": "សេវាកម្ម", "Rating": "ការវាយតម្លៃ",
  "Jobs": "ការងារ", "Applied": "បានដាក់ពាក្យ", "Phone": "ទូរស័ព្ទ", "Language": "ភាសា", "Total paid": "សរុបបានបង់", "Joined": "ចូលរួម",
  "Account": "គណនី", "Code": "លេខកូដ", "Amount": "ចំនួនទឹកប្រាក់", "Created": "បានបង្កើត", "Gross": "សរុប", "Tech net": "សុទ្ធជាង",
  "Confirmed": "បានបញ្ជាក់", "Payout": "ការទូទាត់ឱ្យជាង", "Reference": "លេខយោង", "When": "ពេលវេលា", "Actor": "អ្នកធ្វើ", "Action": "សកម្មភាព",
  "Entity": "ធាតុ", "Before → After": "មុន → ក្រោយ", "Time left": "ពេលនៅសល់", "Deadline": "ផុតកំណត់", "Reason": "មូលហេតុ",
  "Price range": "ជួរតម្លៃ", "Issue": "បញ្ហា", "Photos": "រូបថត", "Opened": "បានបើក", "Scheduled": "កាលវិភាគ", "Address": "អាសយដ្ឋាន",
  "Response deadline": "ផុតកំណត់ឆ្លើយតប", "Cancel reason": "មូលហេតុលុបចោល", "Customer → Technician": "អតិថិជន → ជាង",
  "Service area": "តំបន់សេវា", "Experience": "បទពិសោធន៍", "Certificates": "វិញ្ញាបនបត្រ", "National ID no.": "លេខអត្តសញ្ញាណប័ណ្ណ",
  "Phone (admin only)": "ទូរស័ព្ទ (អ្នកគ្រប់គ្រងប៉ុណ្ណោះ)", "Last review": "ការពិនិត្យចុងក្រោយ", "Paid jobs": "ការងារបានបង់",
  "Awaiting confirmation": "រង់ចាំការបញ្ជាក់",
  // filters & buttons
  "All": "ទាំងអស់", "Approval queue": "ជួរអនុម័ត", "Approved": "បានអនុម័ត", "Suspended": "បានផ្អាក", "Rejected": "បានបដិសេធ",
  "Requested": "បានស្នើ", "In progress": "កំពុងដំណើរការ", "Paid": "បានបង់", "Expired / declined": "ផុតកំណត់ / បដិសេធ", "Cancelled": "បានលុបចោល",
  "Disputed / refunded": "វិវាទ / សងប្រាក់វិញ", "Refunded": "បានសងវិញ", "Pending": "រង់ចាំ", "Processing": "កំពុងដំណើរការ", "Failed": "បរាជ័យ",
  "Open": "បើក", "In review": "កំពុងពិនិត្យ", "Resolved": "បានដោះស្រាយ", "Closed": "បានបិទ",
  "Review": "ពិនិត្យ", "View": "មើល", "Details": "ព័ត៌មានលម្អិត", "Prev": "មុន", "Next": "បន្ទាប់", "Retry": "ព្យាយាមម្តងទៀត", "Save": "រក្សាទុក",
  "Cancel": "បោះបង់", "Create": "បង្កើត", "Approve": "អនុម័ត", "✓ Approve": "✓ អនុម័ត", "Reject": "បដិសេធ", "Suspend": "ផ្អាក", "Reinstate": "បើកវិញ",
  "Disable": "បិទ", "Enable": "បើក", "Refund": "សងប្រាក់វិញ", "Confirm (demo)": "បញ្ជាក់ (សាកល្បង)", "Mark paid": "សម្គាល់ថាបានបង់",
  "Cancel booking": "លុបចោលការកក់", "Mark disputed": "សម្គាល់ថាមានវិវាទ", "Close": "បិទ", "Resolve": "ដោះស្រាយ", "Accept": "ទទួលយក",
  "Start review": "ចាប់ផ្តើមពិនិត្យ", "Save note": "រក្សាទុកកំណត់ចំណាំ", "Edit prices": "កែតម្លៃ", "Activate": "ធ្វើឱ្យសកម្ម",
  "Set coming soon": "កំណត់ជា នឹងមកដល់", "+ New service": "+ សេវាកម្មថ្មី", "⬇ Bookings CSV": "⬇ CSV ការកក់", "⬇ Payments CSV": "⬇ CSV ការទូទាត់",
  "Confirm simulated payment": "បញ្ជាក់ការទូទាត់ក្លែងធ្វើ", "View as table": "មើលជាតារាង", "Show chart": "បង្ហាញក្រាហ្វ",
  "Loading…": "កំពុងផ្ទុក…",
  "Needs attention": "ត្រូវការការយកចិត្តទុកដាក់", "Revenue growth": "កំណើនចំណូល",
  "Cumulative gross paid · last 14 days · USD": "ចំណូលបានបង់សរុបបូកបន្ត · ១៤ ថ្ងៃចុងក្រោយ · ដុល្លារ", "Cumulative gross paid": "ចំណូលបានបង់សរុបបូកបន្ត",
  "technician application": "ពាក្យស្នើសុំជាង", "payment to confirm": "ការទូទាត់ត្រូវបញ្ជាក់", "request waiting": "សំណើកំពុងរង់ចាំ", "Key figures": "តួលេខសំខាន់ៗ", "paid jobs": "ការងារបានបង់", "finished jobs": "ការងារបានបញ្ចប់",
  "Revenue (gross paid)": "ចំណូល (សរុបបានបង់)", "Last 14 days · USD": "១៤ ថ្ងៃចុងក្រោយ · ដុល្លារ", "Last 14 days": "១៤ ថ្ងៃចុងក្រោយ", "in 14 days": "ក្នុង ១៤ ថ្ងៃ",
  "bookings": "ការកក់", "Completed": "បានបញ្ចប់", "Cancelled / disputed": "លុបចោល / វិវាទ", "Operations health": "សុខភាពប្រតិបត្តិការ",
  "All time": "គ្រប់ពេល", "Payment completion": "ការបញ្ចប់ការទូទាត់", "Payouts sent": "ការទូទាត់បានផ្ញើ", "Technicians approved": "ជាងបានអនុម័ត",
  "finished jobs paid": "ការងារបានបង់", "customers": "អតិថិជន", "expired": "ផុតកំណត់", "declined": "បានបដិសេធ",
  "Live requests": "សំណើបច្ចុប្បន្ន", "5-minute response window": "រយៈពេលឆ្លើយតប ៥ នាទី", "Recent bookings": "ការកក់ថ្មីៗ", "View all": "មើលទាំងអស់",
  "No bookings yet": "មិនទាន់មានការកក់", "technician applications": "ពាក្យស្នើសុំជាង", "Verify ID and certificates": "ផ្ទៀងផ្ទាត់អត្តសញ្ញាណប័ណ្ណ និងវិញ្ញាបនបត្រ",
  "payments to confirm": "ការទូទាត់ត្រូវបញ្ជាក់", "requests waiting": "សំណើកំពុងរង់ចាំ", "Technician must respond within 5 minutes": "ជាងត្រូវឆ្លើយតបក្នុង ៥ នាទី",
  "Day": "ថ្ងៃ", "Search name…": "ស្វែងរកឈ្មោះ…", "Code, customer or technician…": "លេខកូដ អតិថិជន ឬជាង…", "Search": "ស្វែងរក",
  "technicians": "ជាង", "payments": "ការទូទាត់", "payouts": "ការទូទាត់ឱ្យជាង", "tickets": "សំបុត្រ", "records": "កំណត់ត្រា", "Collapse": "បង្រួម", "Expand": "ពង្រីក", "DEMO": "សាកល្បង", "Payments are simulated (DEMO)": "ការទូទាត់ជាការក្លែងធ្វើ (សាកល្បង)",
  "No requests are waiting for a technician response.": "គ្មានសំណើកំពុងរង់ចាំការឆ្លើយតបពីជាងទេ។", "waiting": "កំពុងរង់ចាំ",
  "DEMO – simulated KHQR": "សាកល្បង – KHQR ក្លែងធ្វើ", "Open in Google Maps ↗": "បើកក្នុង Google Maps ↗", "No records match this filter.": "គ្មានទិន្នន័យត្រូវនឹងតម្រងនេះទេ។", "Checking admin session…": "កំពុងពិនិត្យការចូល…",
  // statuses
  "REQUESTED": "បានស្នើ", "ACCEPTED": "បានទទួលយក", "DECLINED": "បានបដិសេធ", "EXPIRED": "ផុតកំណត់", "CONFIRMED": "កំពុងធ្វើ",
  "FINISHED": "បានបញ្ចប់", "PAID": "បានបង់", "RATED": "បានវាយតម្លៃ", "CANCELLED": "បានលុបចោល", "CUSTOMER NOT AVAILABLE": "អតិថិជនមិននៅ",
  "DISPUTED": "មានវិវាទ", "REFUNDED": "បានសងវិញ", "CLOSED": "បានបិទ", "PENDING": "រង់ចាំ", "APPROVED": "បានអនុម័ត", "REJECTED": "បានបដិសេធ",
  "SUSPENDED": "បានផ្អាក", "PROCESSING": "កំពុងដំណើរការ", "FAILED": "បរាជ័យ", "OPEN": "បើក", "IN REVIEW": "កំពុងពិនិត្យ", "RESOLVED": "បានដោះស្រាយ",
  "ACTIVE": "សកម្ម", "COMING SOON": "នឹងមកដល់ឆាប់ៗ",
};

interface I18n { lang: Lang; setLang: (l: Lang) => void; tr: (s: string) => string }
const Ctx = createContext<I18n>({ lang: "en", setLang: () => {}, tr: (s) => s });

export function AdminI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === "km" || v === "en") setLangState(v); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  }, []);
  const value = useMemo<I18n>(() => ({ lang, setLang, tr: (s: string) => (lang === "km" ? KM[s] ?? s : s) }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/** Translates a node if it is a plain string; other nodes pass through unchanged. */
export function useTr() {
  const { tr } = useContext(Ctx);
  return <T,>(node: T): T => (typeof node === "string" ? (tr(node) as unknown as T) : node);
}
