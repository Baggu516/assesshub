/** Minimal CSV helpers for student/teacher import (no extra deps). */

export type PersonImportRow = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

/** @deprecated Use PersonImportRow */
export type StudentImportRow = PersonImportRow;

const TEMPLATE_HEADER = 'email,firstName,lastName,password';

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const HEADER_ALIASES: Record<string, keyof PersonImportRow> = {
  email: 'email',
  emailaddress: 'email',
  firstname: 'firstName',
  first: 'firstName',
  givenname: 'firstName',
  lastname: 'lastName',
  last: 'lastName',
  surname: 'lastName',
  familyname: 'lastName',
  password: 'password',
  pass: 'password',
  pwd: 'password',
};

export function parsePersonImportCsv(
  text: string,
  opts?: { label?: string; maxRows?: number }
): { rows: PersonImportRow[]; error?: string } {
  const label = opts?.label || 'row';
  const maxRows = opts?.maxRows ?? 200;
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) return { rows: [], error: 'File is empty' };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], error: `CSV needs a header row and at least one ${label}` };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const index: Partial<Record<keyof PersonImportRow, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key && index[key] === undefined) index[key] = i;
  });

  if (index.email === undefined) {
    return {
      rows: [],
      error: 'Missing email column. Use headers: email, firstName, lastName, password',
    };
  }

  const rows: PersonImportRow[] = [];
  for (let li = 1; li < lines.length; li += 1) {
    const cells = splitCsvLine(lines[li]);
    if (cells.every((c) => !c)) continue;
    const get = (key: keyof PersonImportRow) => {
      const i = index[key];
      return i === undefined ? '' : (cells[i] ?? '').trim();
    };
    rows.push({
      email: get('email'),
      firstName: get('firstName'),
      lastName: get('lastName'),
      password: get('password'),
    });
  }

  if (rows.length === 0) {
    return { rows: [], error: `No ${label} rows found` };
  }
  if (rows.length > maxRows) {
    return { rows: [], error: `Maximum ${maxRows} ${label}s per import` };
  }

  return { rows };
}

export function parseStudentImportCsv(text: string) {
  return parsePersonImportCsv(text, { label: 'student' });
}

export function parseTeacherImportCsv(text: string) {
  return parsePersonImportCsv(text, { label: 'teacher' });
}

function downloadTemplate(filename: string, examples: string[]) {
  const body = `${TEMPLATE_HEADER}\n${examples.join('\n')}\n`;
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadStudentImportTemplate() {
  downloadTemplate('student-import-template.csv', [
    'ada@school.edu,Ada,Lovelace,Welcome123',
    'grace@school.edu,Grace,Hopper,',
  ]);
}

export function downloadTeacherImportTemplate() {
  downloadTemplate('teacher-import-template.csv', [
    'jordan@school.edu,Jordan,Lee,Welcome123',
    'sam@school.edu,Sam,Patel,',
  ]);
}
