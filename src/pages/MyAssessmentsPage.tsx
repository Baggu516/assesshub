import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Spinner';
import { useMyAssignmentsQuery } from '@/hooks/api/useAssessments';

export function MyAssessmentsPage() {
  const { data: assignments = [], isLoading } = useMyAssignmentsQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My assessments"
        description="Assessments assigned to you by your teacher."
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No assessments assigned yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-slate-900 dark:text-white">{a.assessmentTitle}</h3>
                  <Badge tone={a.status === 'submitted' ? 'success' : 'warning'}>
                    {a.status === 'submitted' ? `Score: ${a.score}/${a.maxScore}` : 'Pending'}
                  </Badge>
                </div>
                {a.dueDate && (
                  <p className="text-xs text-slate-500 mt-1">
                    Due: {new Date(a.dueDate).toLocaleString()}
                  </p>
                )}
                {a.status === 'submitted' && a.submittedAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Submitted: {new Date(a.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {a.status === 'pending' ? (
                  <Link to={`/my-assessments/${a.id}`}>
                    <Button size="sm">Start</Button>
                  </Link>
                ) : (
                  <Link to={`/my-assessments/${a.id}`}>
                    <Button variant="secondary" size="sm">
                      View results
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
