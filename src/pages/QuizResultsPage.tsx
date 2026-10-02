import { Link, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { useTenantOrganization } from '@/hooks/api/useTenant';
import { useAssessmentMutations, useAssessmentResultsQuery } from '@/hooks/api/useAssessments';

type QuizResultRow = {
  id: string;
  studentName?: string;
  status: string;
  scoredMarks?: number;
  totalMarks?: number;
  percentage?: number;
  correctCount?: number;
  wrongCount?: number;
};

function rankAt(rows: QuizResultRow[], index: number) {
  const mark = Math.round(rows[index]?.percentage || 0);
  const first = rows.findIndex((item) => Math.round(item.percentage || 0) === mark);
  return first + 1;
}

function downloadResultsPdf(title: string, school: string, rows: QuizResultRow[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  if (school) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(school, pageWidth / 2, y, { align: 'center' });
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  const heading = doc.splitTextToSize(title || 'Quiz results', pageWidth - 28);
  doc.text(heading, pageWidth / 2, y, { align: 'center' });
  y += heading.length * 9 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  const dated = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(dated, pageWidth / 2, y, { align: 'center' });

  const total = rows[0]?.totalMarks ?? 0;
  autoTable(doc, {
    startY: y + 8,
    head: [['Rank', 'Name', `Marks obtained out of ${total}`]],
    body: rows.map((row, index) => [
      String(rankAt(rows, index)),
      row.studentName || 'Student',
      String(row.scoredMarks ?? 0),
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 12,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      cellPadding: 4,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 12,
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 62, halign: 'center' },
    },
    didParseCell: (cell) => {
      if (cell.section !== 'body' || cell.column.index !== 0) return;
      const rank = Number(cell.cell.raw);
      cell.cell.styles.fontStyle = 'bold';
      cell.cell.styles.fontSize = 14;
      if (rank === 1) {
        cell.cell.styles.fillColor = [254, 243, 199];
        cell.cell.styles.textColor = [146, 64, 14];
      } else if (rank === 2) {
        cell.cell.styles.fillColor = [226, 232, 240];
        cell.cell.styles.textColor = [51, 65, 85];
      } else if (rank === 3) {
        cell.cell.styles.fillColor = [255, 237, 213];
        cell.cell.styles.textColor = [154, 52, 18];
      } else {
        cell.cell.styles.fillColor = [240, 253, 250];
        cell.cell.styles.textColor = [15, 118, 110];
      }
    },
    margin: { left: 14, right: 14 },
  });

  const file = `${(title || 'quiz').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'quiz'}-results.pdf`;
  doc.save(file);
}

export function QuizResultsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { data: org } = useTenantOrganization();
  const { data, isLoading } = useAssessmentResultsQuery(quizId, 'all');
  const { releaseResults } = useAssessmentMutations();

  const rows = ((data?.results || []) as QuizResultRow[]).filter((row) => row.status === 'submitted');
  const ranked = [...rows].sort(
    (a, b) => (b.percentage || 0) - (a.percentage || 0) || (b.scoredMarks || 0) - (a.scoredMarks || 0)
  );
  const released = Boolean(data?.assessment.resultsReleased);
  const pending = data?.summary.pendingReleaseCount || 0;

  const release = async () => {
    if (!quizId) return;
    try {
      await releaseResults.mutateAsync(quizId);
      toast.success('Results released. Students can open their score.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not release results');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teacher"
        title={data?.assessment.title || 'Quiz results'}
        description="Score, performance, and rank for everyone who finished."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/quizzes">
              <Button variant="secondary">Back to quizzes</Button>
            </Link>
            <Button
              variant="secondary"
              disabled={ranked.length === 0}
              onClick={() => downloadResultsPdf(data?.assessment.title || 'Quiz results', org?.name || '', ranked)}
            >
              Download PDF
            </Button>
            <Button disabled={!quizId || pending === 0 || releaseResults.isPending} onClick={() => void release()}>
              {releaseResults.isPending ? 'Releasing…' : released && pending === 0 ? 'Results released' : 'Release results'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : ranked.length === 0 ? (
        <Card className="p-0">
          <EmptyState title="No finished attempts yet" description="Scores appear here as students submit." />
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone={released ? 'success' : 'warning'}>{released ? 'Released to students' : 'Held from students'}</Badge>
            <Badge tone="neutral">
              Average {Math.round(data?.summary.averagePercentage || 0)}%
            </Badge>
          </div>
          {ranked.map((row, index) => {
            const rank = rankAt(ranked, index);
            const score = `${row.scoredMarks ?? 0}/${row.totalMarks ?? 0}`;
            const performance = Math.round(row.percentage || 0);
            return (
              <Card key={row.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 font-display text-2xl font-bold text-brand-800 dark:bg-brand-500/15 dark:text-brand-100">
                  {rank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                    {row.studentName || 'Student'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Rank {rank} · {row.correctCount ?? 0} correct · {row.wrongCount ?? 0} wrong
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${performance}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:w-56">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-950/50">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Score</p>
                    <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">{score}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-950/50">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Performance</p>
                    <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">{performance}%</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
