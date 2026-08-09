import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, FormField, Input, Modal, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import type { AssessmentQuestion } from '@/hooks/api/useAssessments';

export type AiAssessmentDraft = {
  title: string;
  description: string;
  questions: AssessmentQuestion[];
};

type CreateWithAiModalProps = {
  open: boolean;
  onClose: () => void;
  onGenerated: (draft: AiAssessmentDraft) => void;
};

export function CreateWithAiModal({ open, onClose, onGenerated }: CreateWithAiModalProps) {
  const [prompt, setPrompt] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPrompt('');
    setQuestionCount(5);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (text.length < 8 || loading) return;

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<AiAssessmentDraft>(
        '/ai/generate-questions',
        {
          prompt: text,
          questionCount,
        },
        { timeout: 180_000 }
      );
      if (!data.questions?.length) {
        throw new Error('No questions were generated');
      }
      toast.success(`Generated ${data.questions.length} question${data.questions.length === 1 ? '' : 's'}`);
      onGenerated({
        title: data.title,
        description: data.description || '',
        questions: data.questions.map((q, i) => ({
          ...q,
          order: i,
          options: q.options || [],
          acceptedAnswers: q.acceptedAnswers || [],
        })),
      });
      reset();
      onClose();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string }; status?: number }; message?: string };
      setError(
        ax.response?.data?.error ||
          (ax.response?.status === 503 ? 'AI is not configured on the server.' : null) ||
          ax.message ||
          'Could not generate questions. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create assessment with AI"
      description="Describe the topic, level, and focus. We’ll draft questions you can edit before saving."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={prompt.trim().length < 8 || loading}
          >
            {loading ? 'Generating…' : 'Generate questions'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="Prompt"
          htmlFor="ai-assessment-prompt"
          required
          hint="Example: Create a 5-question quiz on nursing vital signs for first-year students."
        >
          <Textarea
            id="ai-assessment-prompt"
            className="min-h-[140px] rounded-xl"
            placeholder="What should this assessment cover?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </FormField>

        <FormField
          label="Number of questions"
          htmlFor="ai-assessment-count"
          className="max-w-[10rem]"
        >
          <Input
            id="ai-assessment-count"
            type="number"
            min={1}
            max={20}
            value={questionCount}
            onChange={(e) => {
              const n = Number(e.target.value) || 1;
              setQuestionCount(Math.min(20, Math.max(1, n)));
            }}
            disabled={loading}
          />
        </FormField>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-xs text-slate-500">This can take a little while depending on the AI provider…</p>
        ) : null}
      </div>
    </Modal>
  );
}
