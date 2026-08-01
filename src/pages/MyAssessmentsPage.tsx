import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
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
        <Card className="p-0">
          <EmptyState
            title="No assessments yet"
            description="When your teacher assigns a quiz, it will show up here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card
              key={a.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {a.assessmentTitle}
                  </h3>
                  <Badge tone={a.status === 'submitted' ? 'success' : 'warning'}>
                    {a.status === 'submitted' ? `Score: ${a.score}/${a.maxScore}` : 'Pending'}
                  </Badge>
                </div>
                {a.dueDate && (
                  <p className="mt-1 text-xs text-slate-500">
                    Due: {new Date(a.dueDate).toLocaleString()}
                  </p>
                )}
                {a.status === 'submitted' && a.submittedAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted: {new Date(a.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <Link to={`/my-assessments/${a.id}`}>
                  <Button size="sm" variant={a.status === 'pending' ? 'primary' : 'secondary'}>
                    {a.status === 'pending' ? 'Start' : 'View results'}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
