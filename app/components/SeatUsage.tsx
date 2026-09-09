// Seats bought vs students actually using them. Licensed students come from per-student
// license line items on active deals (lib/arr.ts); rostered students and setup % come from the
// product's daily push to HubSpot. Students with accounts = rostered × setup %.
export function seatUsage(account: {
  licensedStudents: number | null
  licensedMiddleSchool: number | null
  rosteredStudents: number | null
  studentsCompletedSetupPct: number | null
}) {
  const withAccounts =
    account.rosteredStudents !== null && account.studentsCompletedSetupPct !== null
      ? Math.round(account.rosteredStudents * account.studentsCompletedSetupPct)
      : null
  const pctOfLicensed =
    withAccounts !== null && account.licensedStudents
      ? Math.round((withAccounts / account.licensedStudents) * 100)
      : null
  const pctOfRostered =
    account.studentsCompletedSetupPct !== null ? Math.round(account.studentsCompletedSetupPct * 100) : null
  return { withAccounts, pctOfLicensed, pctOfRostered }
}

const n = (v: number) => v.toLocaleString('en-US')

export function SeatUsage({
  account,
}: {
  account: {
    licensedStudents: number | null
    licensedMiddleSchool: number | null
    rosteredStudents: number | null
    studentsCompletedSetupPct: number | null
  }
}) {
  const { withAccounts, pctOfLicensed, pctOfRostered } = seatUsage(account)
  if (account.licensedStudents === null && account.rosteredStudents === null) return null

  const tone =
    pctOfLicensed === null ? 'text-slate-500'
    : pctOfLicensed >= 70 ? 'text-emerald-700'
    : pctOfLicensed >= 40 ? 'text-yellow-700'
    : 'text-red-700'

  return (
    <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Licensed students</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">
          {account.licensedStudents !== null ? n(account.licensedStudents) : '—'}
        </p>
        {account.licensedMiddleSchool ? (
          <p className="text-xs text-slate-400">+ {n(account.licensedMiddleSchool)} middle school</p>
        ) : null}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rostered (grades 9–12)</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">
          {account.rosteredStudents !== null ? n(account.rosteredStudents) : '—'}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Students with accounts</p>
        <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{withAccounts !== null ? n(withAccounts) : '—'}</p>
        <p className="text-xs text-slate-400">
          {pctOfLicensed !== null ? `${pctOfLicensed}% of licensed` : 'licensed count unknown'}
          {pctOfRostered !== null ? ` · ${pctOfRostered}% of rostered` : ''}
        </p>
      </div>
    </div>
  )
}
